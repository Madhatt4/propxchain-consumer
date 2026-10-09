import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc, logEvent } = vi.hoisted(() => ({ rpc: vi.fn(), logEvent: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/services/icp.service', () => ({ icpService: { ledgerManager: { logEvent } } }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { checkPlotClaim, claimPlot, plotClaimBlockedReason, releaseMyPlot } from '../plotClaim.service';

describe('plotClaim.service', () => {
  beforeEach(() => {
    rpc.mockReset();
    logEvent.mockReset().mockResolvedValue({ ok: BigInt(1) });
  });

  it('should ask the server whether the signed-in buyer may claim the code', async () => {
    rpc.mockResolvedValue({ data: 'reserved_for_other', error: null });

    const check = await checkPlotClaim('TX-ABCD-EFGH');

    expect(rpc).toHaveBeenCalledWith('check_plot_claim', { p_code: 'TX-ABCD-EFGH' });
    expect(check).toBe('reserved_for_other');
  });

  it('should explain every blocked outcome and allow ok', () => {
    expect(plotClaimBlockedReason('ok')).toBeNull();
    expect(plotClaimBlockedReason('reserved_for_other')).toMatch(/reserved for another buyer/);
    expect(plotClaimBlockedReason('taken')).toMatch(/already been reserved/);
    expect(plotClaimBlockedReason('not_found')).toMatch(/could not find/);
  });

  it('should claim through the server and log a ledger event with no personal data', async () => {
    rpc.mockResolvedValue({ data: 'plot-uuid', error: null });

    const plotId = await claimPlot('TX-ABCD-EFGH', 'tx_42');

    expect(rpc).toHaveBeenCalledWith('claim_plot', { p_code: 'TX-ABCD-EFGH', p_transaction_id: 'tx_42' });
    expect(plotId).toBe('plot-uuid');
    expect(logEvent).toHaveBeenCalledWith('tx_42', 'plot_claimed', 'Buyer claimed the developer plot', [
      JSON.stringify({ plotId: 'plot-uuid' }),
    ]);
  });

  it('should throw and log nothing when the server refuses the claim', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'this plot is not available to you' } });

    await expect(claimPlot('TX-ABCD-EFGH', 'tx_42')).rejects.toThrow(/not available to you/);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("should release the leaving buyer's own plot through the server", async () => {
    rpc.mockResolvedValue({ data: 'plot-uuid', error: null });

    expect(await releaseMyPlot('tx_42')).toBe('plot-uuid');
    expect(rpc).toHaveBeenCalledWith('release_my_plot', { p_transaction_id: 'tx_42' });
  });

  it('should report nothing to release as null and a server error as a throw', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await releaseMyPlot('tx_42')).toBeNull();

    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(releaseMyPlot('tx_42')).rejects.toThrow(/Could not release this plot: boom/);
  });
});
