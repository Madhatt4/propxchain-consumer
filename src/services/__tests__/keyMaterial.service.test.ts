import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

function session(userId: string, accessToken = 'jwt-token'): {
  data: { session: { access_token: string; user: { id: string } } };
} {
  return { data: { session: { access_token: accessToken, user: { id: userId } } } };
}

const SESSION = session('user-a');
const GOOD_MATERIAL_B64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

const mockFetch = vi.fn();

function fetchResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

// The material cache is module-level state (by design — it must survive
// across calls within a page load). Rather than a shipped test-only cache
// clearer, each test gets a clean module instance via vi.resetModules() + a
// fresh dynamic import.
let keyMaterialService: typeof import('../keyMaterial.service')['keyMaterialService'];
let MaterialUnavailableError: typeof import('../keyMaterial.service')['MaterialUnavailableError'];
let MaterialRateLimitedError: typeof import('../keyMaterial.service')['MaterialRateLimitedError'];

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal('fetch', mockFetch);
  mockGetSession.mockResolvedValue(SESSION);
  const mod = await import('../keyMaterial.service');
  keyMaterialService = mod.keyMaterialService;
  MaterialUnavailableError = mod.MaterialUnavailableError;
  MaterialRateLimitedError = mod.MaterialRateLimitedError;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('keyMaterialService.getMaterial', () => {
  it('should return 32-byte material and the served pepper version', async () => {
    mockFetch.mockResolvedValue(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 1 }),
    );

    const result = await keyMaterialService.getMaterial();

    expect(result.material).toHaveLength(32);
    expect(result.pepperVersion).toBe(1);
  });

  it('should send the requested pepper version in the body when decrypting an old blob', async () => {
    mockFetch.mockResolvedValue(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 3 }),
    );

    await keyMaterialService.getMaterial(3);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ pepperVersion: 3 });
  });

  it('should cache material for the page load (one oracle call, not one per operation)', async () => {
    mockFetch.mockResolvedValue(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 1 }),
    );

    await keyMaterialService.getMaterial();
    await keyMaterialService.getMaterial();
    // The echoed version is also cached, so decrypting a v2.1 blob after a
    // fresh encrypt needs no second round trip.
    await keyMaterialService.getMaterial(1);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw MaterialUnavailableError when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(keyMaterialService.getMaterial()).rejects.toThrow(MaterialUnavailableError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw MaterialRateLimitedError on 429 — retry-later, never decrypt failure', async () => {
    mockFetch.mockResolvedValue(fetchResponse(429, { error: 'rate_limited' }));

    await expect(keyMaterialService.getMaterial()).rejects.toThrow(MaterialRateLimitedError);
  });

  it('should throw MaterialUnavailableError when the oracle is unreachable', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(keyMaterialService.getMaterial()).rejects.toThrow(MaterialUnavailableError);
  });

  it('should reject material that does not decode to exactly 32 bytes', async () => {
    mockFetch.mockResolvedValue(
      fetchResponse(200, { material: btoa('short'), pepperVersion: 1 }),
    );

    await expect(keyMaterialService.getMaterial()).rejects.toThrow(
      /16 bytes|expected 32|is 5 bytes/,
    );
  });

  it('should reject a malformed response body', async () => {
    mockFetch.mockResolvedValue(fetchResponse(200, { nope: true }));

    await expect(keyMaterialService.getMaterial()).rejects.toThrow(MaterialUnavailableError);
  });

  it('should not cache failures', async () => {
    mockFetch.mockResolvedValueOnce(fetchResponse(500, { error: 'internal_error' }));
    await expect(keyMaterialService.getMaterial()).rejects.toThrow(MaterialUnavailableError);

    mockFetch.mockResolvedValueOnce(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 1 }),
    );
    await expect(keyMaterialService.getMaterial()).resolves.toBeTruthy();
  });

  it('should throw MaterialUnavailableError when the oracle echoes a version other than requested', async () => {
    mockFetch.mockResolvedValue(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 2 }),
    );

    await expect(keyMaterialService.getMaterial(3)).rejects.toThrow(MaterialUnavailableError);
  });
});

describe('per-user cache scoping (cross-user cache poisoning guard)', () => {
  it('should not return user As cached material for user B on a shared device (no reload)', async () => {
    mockGetSession.mockResolvedValueOnce(session('user-a', 'jwt-a'));
    mockFetch.mockResolvedValueOnce(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 1 }),
    );
    const materialA = await keyMaterialService.getMaterial();

    const otherMaterialB64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
    mockGetSession.mockResolvedValueOnce(session('user-b', 'jwt-b'));
    mockFetch.mockResolvedValueOnce(
      fetchResponse(200, { material: otherMaterialB64, pepperVersion: 1 }),
    );
    const materialB = await keyMaterialService.getMaterial();

    // A fresh oracle call happened for B — the cache entry keyed under A's
    // session was not reused for B, even though the pepperVersion matched.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(materialB.material).not.toEqual(materialA.material);
  });

  it('should still cache per-request for the SAME user across repeat calls', async () => {
    mockGetSession.mockResolvedValue(session('user-a', 'jwt-a'));
    mockFetch.mockResolvedValueOnce(
      fetchResponse(200, { material: GOOD_MATERIAL_B64, pepperVersion: 1 }),
    );

    await keyMaterialService.getMaterial();
    await keyMaterialService.getMaterial();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
