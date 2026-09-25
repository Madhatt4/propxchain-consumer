import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNextStep } from '../next-step.service';

const mockIcpGetNextStep = vi.fn();
const mockSupabaseSelect = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: {
    getNextStep: (...args: unknown[]) => mockIcpGetNextStep(...args),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: (...args: unknown[]) => mockSupabaseSelect(...args),
      })),
    })),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function rawCanisterRec(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    blocker: 'no_solicitor',
    blockerLabel: 'Solicitor not yet assigned',
    urgency: { blocking: null },
    why: 'why',
    partial: false,
    options: [
      {
        action: 'browse_conveyancer_panel',
        displayLabel: 'Browse the conveyancer panel',
        whyThis: 'matches',
        estimatedDelayIfSkipped: [5n],
      },
    ],
    ...over,
  };
}

describe('next-step.service', () => {
  beforeEach(() => {
    mockIcpGetNextStep.mockReset();
    mockSupabaseSelect.mockReset();
  });

  it('unwraps the canister Result and converts urgency variant to text', async () => {
    mockIcpGetNextStep.mockResolvedValue({ ok: rawCanisterRec({ urgency: { soon: null }, blocker: 'hmlr_not_fetched' }) });
    const out = await getNextStep('tx_test');
    expect('ok' in out).toBe(true);
    if ('ok' in out) {
      expect(out.ok.urgency).toBe('soon');
      expect(out.ok.blocker).toBe('hmlr_not_fetched');
    }
  });

  it('decodes ?Nat (estimatedDelayIfSkipped) from candid opt encoding', async () => {
    mockIcpGetNextStep.mockResolvedValue({ ok: rawCanisterRec({ blocker: 'hmlr_not_fetched' }) });
    const out = await getNextStep('tx_test');
    if ('ok' in out) {
      expect(out.ok.options[0].estimatedDelayIfSkipped).toBe(5);
    }
  });

  it('treats `[]` as None for ?Nat without throwing', async () => {
    mockIcpGetNextStep.mockResolvedValue({
      ok: rawCanisterRec({
        blocker: 'hmlr_not_fetched',
        options: [
          {
            action: 'fetch_hmlr_title',
            displayLabel: 'Fetch HMLR title register',
            whyThis: 'why',
            estimatedDelayIfSkipped: [],
          },
        ],
      }),
    });
    const out = await getNextStep('tx_test');
    if ('ok' in out) {
      expect(out.ok.options[0].estimatedDelayIfSkipped).toBeUndefined();
    }
  });

  it('classifies transaction_not_found as not_found', async () => {
    mockIcpGetNextStep.mockResolvedValue({ err: 'transaction_not_found' });
    const out = await getNextStep('tx_missing');
    expect('err' in out).toBe(true);
    if ('err' in out) {
      expect(out.err.code).toBe('not_found');
    }
  });

  it('classifies access_denied', async () => {
    mockIcpGetNextStep.mockResolvedValue({ err: 'access_denied' });
    const out = await getNextStep('tx_locked');
    if ('err' in out) {
      expect(out.err.code).toBe('access_denied');
    }
  });

  it('enriches no_solicitor blocker with panel-match count from supabase', async () => {
    mockIcpGetNextStep.mockResolvedValue({ ok: rawCanisterRec() });
    mockSupabaseSelect.mockResolvedValue({ count: 42, error: null });
    const out = await getNextStep('tx_test');
    if ('ok' in out) {
      const browse = out.ok.options.find((o) => o.action === 'browse_conveyancer_panel');
      expect(browse?.panelMatchCount).toBe(42);
    }
  });

  it('falls back to canister-only output when supabase enrichment fails', async () => {
    mockIcpGetNextStep.mockResolvedValue({ ok: rawCanisterRec() });
    mockSupabaseSelect.mockResolvedValue({ count: null, error: { message: 'rls' } });
    const out = await getNextStep('tx_test');
    if ('ok' in out) {
      const browse = out.ok.options.find((o) => o.action === 'browse_conveyancer_panel');
      expect(browse?.panelMatchCount).toBeUndefined();
    }
  });

  it('does not call supabase when blocker is not no_solicitor', async () => {
    mockIcpGetNextStep.mockResolvedValue({
      ok: rawCanisterRec({ blocker: 'hmlr_not_fetched' }),
    });
    await getNextStep('tx_test');
    expect(mockSupabaseSelect).not.toHaveBeenCalled();
  });

  it('returns unknown error code on canister throw', async () => {
    mockIcpGetNextStep.mockRejectedValue(new Error('network'));
    const out = await getNextStep('tx_test');
    if ('err' in out) {
      expect(out.err.code).toBe('unknown');
      expect(out.err.message).toBe('network');
    }
  });
});
