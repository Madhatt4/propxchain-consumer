import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { addToWaitlist, isValidEmail, type WaitlistPayload } from '../waitlist';

const mockFetch = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FULL_PAYLOAD: WaitlistPayload = {
  name: 'Marc Hatton',
  email: 'marc@example.com',
  role: 'seller',
  postcode: 'SG19 1AB',
  houseNumber: '14a',
  timeline: '1_3_months',
  source: 'home_mover_report',
};

describe('waitlist service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should POST the full Home Mover Report payload to the waitlist Worker', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, duplicate: false }));

    const result = await addToWaitlist(FULL_PAYLOAD);

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(FULL_PAYLOAD);
  });

  it('should report duplicate when the Worker flags an existing email', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, duplicate: true }));

    const result = await addToWaitlist(FULL_PAYLOAD);

    expect(result).toEqual({ ok: true, duplicate: true });
  });

  it('should surface the Worker error message on a rejected payload', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Invalid postcode' }, 400));

    const result = await addToWaitlist({ ...FULL_PAYLOAD, postcode: 'nope' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Invalid postcode');
  });

  it('should return ok false when the network request throws', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await addToWaitlist(FULL_PAYLOAD);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });
});

describe('isValidEmail', () => {
  it('should accept a normal address and reject obvious garbage', () => {
    expect(isValidEmail('marc@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});
