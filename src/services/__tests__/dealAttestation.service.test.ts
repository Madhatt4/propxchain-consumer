import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invoke, warn } = vi.hoisted(() => ({ invoke: vi.fn(), warn: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn, error: vi.fn(), info: vi.fn() } }));

import {
  attestDealEvent,
  DealAttestationError,
  recordDealAttestation,
  type DealAttestationRequest,
} from '../dealAttestation.service';

function httpError(status: number, body: unknown): { message: string; context: { status: number; json: () => Promise<unknown> } } {
  return { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } };
}

describe('dealAttestation.service', () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({ data: { recorded: true, eventId: '12' }, error: null });
    warn.mockReset();
  });

  it.each<DealAttestationRequest>([
    { kind: 'search_signoff', signOffId: 's1' },
    { kind: 'search_signoff_revoked', signOffId: 's1' },
    { kind: 'plot_claim', transactionId: 'tx_42' },
  ])('should invoke deal-attest with exactly the $kind body', async (request) => {
    // Arrange: default success mock

    // Act
    await attestDealEvent(request);

    // Assert
    expect(invoke).toHaveBeenCalledWith('deal-attest', { body: request });
  });

  it('should return the server result, including an already-recorded flag', async () => {
    invoke.mockResolvedValue({ data: { recorded: true, alreadyRecorded: true }, error: null });

    const result = await attestDealEvent({ kind: 'plot_claim', transactionId: 'tx_42' });

    expect(result).toEqual({ recorded: true, alreadyRecorded: true });
  });

  it('should throw a DealAttestationError carrying the status and server error code', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'not_a_party' }) });

    const failure = attestDealEvent({ kind: 'search_signoff', signOffId: 's1' });

    await expect(failure).rejects.toBeInstanceOf(DealAttestationError);
    await expect(failure).rejects.toMatchObject({ status: 403, code: 'not_a_party' });
  });

  it('should fall back to the invoke message when the error body is unreadable', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'boom', context: { status: 500, json: async () => { throw new Error('not json'); } } },
    });

    await expect(attestDealEvent({ kind: 'plot_claim', transactionId: 'tx_1' })).rejects.toMatchObject({ status: 500, code: 'boom' });
  });

  it('should treat an empty response as a failure', async () => {
    invoke.mockResolvedValue({ data: null, error: null });

    await expect(attestDealEvent({ kind: 'plot_claim', transactionId: 'tx_1' })).rejects.toMatchObject({ code: 'empty response' });
  });

  it('should not throw from the fire-and-forget form when the invoke rejects', async () => {
    invoke.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(() => recordDealAttestation({ kind: 'search_signoff', signOffId: 's1' })).not.toThrow();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(warn).toHaveBeenCalledWith('[dealAttest] attestation not recorded', { kind: 'search_signoff', code: 'invoke_failed' });
  });

  it('should log only the kind and the server error code on refusal', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(404, { error: 'signoff_not_found' }) });

    recordDealAttestation({ kind: 'search_signoff_revoked', signOffId: 's1' });
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(warn).toHaveBeenCalledWith('[dealAttest] attestation not recorded', {
      kind: 'search_signoff_revoked',
      code: 'signoff_not_found',
    });
  });
});
