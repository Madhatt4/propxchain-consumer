import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ed25519KeyIdentity } from '@propxchain/core-client';
import {
  conveyancerJoinService,
  PENDING_JOIN_CODE_KEY,
} from '../../services/conveyancerJoin.service';
import { supabase } from '../../lib/supabase';
import { icpService } from '../../services/icp.service';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn() },
  },
}));

vi.mock('../../services/icp.service', () => ({
  icpService: { getAuthenticatedIdentity: vi.fn() },
}));

const CODE = 'a'.repeat(64);
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
// A real key — the proof is a real signature, so the test exercises the same
// path the edge function verifies (#130).
const testIdentity = Ed25519KeyIdentity.generate();

describe('conveyancerJoinService.previewJoinCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return the preview when the code is valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        firmName: 'Smith Conveyancing',
        firmCity: 'Bedford',
        firmPostcode: 'MK40 1AA',
        clcId: '1234567',
        propertyAddress: '1 Test Street',
        transactionType: 'sale',
        expiresAt: '2099-01-01T00:00:00Z',
      }),
    }));

    const result = await conveyancerJoinService.previewJoinCode(CODE);

    expect(result.error).toBeUndefined();
    expect(result.preview?.firmName).toBe('Smith Conveyancing');
    expect(result.preview?.clcId).toBe('1234567');
  });

  it('should surface already_redeemed and expired distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'already_redeemed' }),
    }));
    expect((await conveyancerJoinService.previewJoinCode(CODE)).error).toBe('already_redeemed');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'expired' }),
    }));
    expect((await conveyancerJoinService.previewJoinCode(CODE)).error).toBe('expired');
  });

  it('should return invalid_code for unknown error shapes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('no body')),
    }));
    expect((await conveyancerJoinService.previewJoinCode(CODE)).error).toBe('invalid_code');
  });

  it('should return network when the fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await conveyancerJoinService.previewJoinCode(CODE)).error).toBe('network');
  });
});

describe('conveyancerJoinService.redeemJoinCode', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
    // Redemption now signs a principal proof (#130), so it needs both an
    // authenticated Supabase user and a signing identity.
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: TEST_USER_ID } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    vi.mocked(icpService.getAuthenticatedIdentity).mockResolvedValue(
      testIdentity as unknown as Awaited<ReturnType<typeof icpService.getAuthenticatedIdentity>>,
    );
  });

  it('should return success with the transaction details', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true, transactionId: 'tx-1', firmName: 'Smith Conveyancing', clcId: '1234567' },
      error: null,
    });

    const result = await conveyancerJoinService.redeemJoinCode(CODE);

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('tx-1');
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'redeem-conveyancer-join',
      expect.objectContaining({ body: expect.objectContaining({ code: CODE }) }),
    );
  });

  it('should send a signed identity proof when redeeming a join code', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true, transactionId: 'tx-1' },
      error: null,
    });

    await conveyancerJoinService.redeemJoinCode(CODE);

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'redeem-conveyancer-join',
      expect.objectContaining({
        body: expect.objectContaining({
          code: CODE,
          principal: testIdentity.getPrincipal().toText(),
          publicKeyDer: expect.any(String),
          signature: expect.any(String),
        }),
      }),
    );
  });

  it('should refuse to redeem when there is no signing identity', async () => {
    vi.mocked(icpService.getAuthenticatedIdentity).mockResolvedValue(null);

    const result = await conveyancerJoinService.redeemJoinCode(CODE);

    expect(result).toEqual({ success: false, error: 'no_principal' });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('should unwrap the edge function error body on failure', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: { json: () => Promise.resolve({ error: 'no_principal', message: 'sign in first' }) },
      }),
    });

    const result = await conveyancerJoinService.redeemJoinCode(CODE);

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_principal');
    expect(result.detail).toBe('sign in first');
  });
});

describe('pending join code stash', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should stash, read, and clear the pending code', () => {
    expect(conveyancerJoinService.readPendingJoinCode()).toBeNull();
    conveyancerJoinService.stashPendingJoinCode(CODE);
    expect(localStorage.getItem(PENDING_JOIN_CODE_KEY)).toBe(CODE);
    expect(conveyancerJoinService.readPendingJoinCode()).toBe(CODE);
    conveyancerJoinService.clearPendingJoinCode();
    expect(conveyancerJoinService.readPendingJoinCode()).toBeNull();
  });
});
