import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc, invoke, warn } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), warn: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn, error: vi.fn(), info: vi.fn() } }));

import {
  checkPlotClaim,
  claimPlot,
  getPlotDeveloperPrincipal,
  plotClaimBlockedReason,
  releaseMyPlot,
} from '../plotClaim.service';

describe('plotClaim.service', () => {
  beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset().mockResolvedValue({ data: { recorded: true }, error: null });
    warn.mockReset();
  });

  it('should ask the server whether the signed-in buyer may claim the code', async () => {
    rpc.mockResolvedValue({ data: 'reserved_for_other', error: null });

    const check = await checkPlotClaim('TX-ABCD-EFGH');

    expect(rpc).toHaveBeenCalledWith('check_plot_claim', { p_code: 'TX-ABCD-EFGH' });
    expect(check).toBe('reserved_for_other');
  });

  it('should look the developer principal up by invite code, never by plot id', async () => {
    rpc.mockResolvedValue({ data: 'aaaaa-bbbbb-ccccc-ddddd-eeeee-fff', error: null });

    const principal = await getPlotDeveloperPrincipal('TX-ABCD-EFGH');

    expect(rpc).toHaveBeenCalledWith('get_plot_developer_principal_by_code', { p_code: 'TX-ABCD-EFGH' });
    expect(principal).toBe('aaaaa-bbbbb-ccccc-ddddd-eeeee-fff');
  });

  it('should return null when the developer has not pinned a principal yet', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    expect(await getPlotDeveloperPrincipal('TX-ABCD-EFGH')).toBeNull();
  });

  it('should throw when the principal lookup fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(getPlotDeveloperPrincipal('TX-ABCD-EFGH')).rejects.toThrow(/Could not resolve the developer/);
  });

  it('should explain every blocked outcome and allow ok', () => {
    expect(plotClaimBlockedReason('ok')).toBeNull();
    expect(plotClaimBlockedReason('reserved_for_other')).toMatch(/reserved for another buyer/);
    expect(plotClaimBlockedReason('taken')).toMatch(/already been reserved/);
    expect(plotClaimBlockedReason('not_found')).toMatch(/could not find/);
  });

  it('should claim through the server and ask deal-attest to record it by transaction id only', async () => {
    rpc.mockResolvedValue({ data: 'plot-uuid', error: null });

    const plotId = await claimPlot('TX-ABCD-EFGH', 'tx_42');

    expect(rpc).toHaveBeenCalledWith('claim_plot', { p_code: 'TX-ABCD-EFGH', p_transaction_id: 'tx_42' });
    expect(plotId).toBe('plot-uuid');
    expect(invoke).toHaveBeenCalledWith('deal-attest', { body: { kind: 'plot_claim', transactionId: 'tx_42' } });
  });

  it('should still return the plot when the attestation call fails', async () => {
    rpc.mockResolvedValue({ data: 'plot-uuid', error: null });
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'not found', context: { status: 404, json: async () => ({ error: 'not_deployed' }) } },
    });

    const plotId = await claimPlot('TX-ABCD-EFGH', 'tx_42');
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(plotId).toBe('plot-uuid');
    expect(warn).toHaveBeenCalledWith('[dealAttest] attestation not recorded', { kind: 'plot_claim', code: 'not_deployed' });
  });

  it('should throw and attest nothing when the server refuses the claim', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'this plot is not available to you' } });

    await expect(claimPlot('TX-ABCD-EFGH', 'tx_42')).rejects.toThrow(/not available to you/);
    expect(invoke).not.toHaveBeenCalled();
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
