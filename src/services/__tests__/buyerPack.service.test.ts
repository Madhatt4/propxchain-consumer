// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { BuyerPackError, declareBuyerPack, loadBuyerPack, mergeWithLedger, syncBuyerPack } from '../buyerPack.service';

function ledgerQuery(result: { data: unknown; error: unknown }): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  q.select = () => q; q.eq = () => q; q.order = () => Promise.resolve(result);
  return q;
}

const STATUS = [
  { item: 'id_aml', status: 'ready', detail: { aml_state: 'complete' } },
  { item: 'proof_of_funds', status: 'not_started', detail: {} },
  { item: 'mortgage', status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Halifax', mortgage_stage: 'none' } },
  { item: 'chain', status: 'ready', detail: null },
  { item: 'survey', status: 'not_started', detail: { survey_state: 'none' } },
] as const;

describe('buyerPack.service', () => {
  beforeEach(() => { mockInvoke.mockReset(); mockRpc.mockReset(); mockFrom.mockReset(); });

  it('mergeWithLedger: ready + newest ledger row ready and settled = on the ledger; pending rows show as pending', () => {
    const items = mergeWithLedger([...STATUS], [
      { item: 'id_aml', status: 'ready', ledger_pending: false, created_at: '2026-09-05T12:00:00Z' },
      { item: 'chain', status: 'ready', ledger_pending: true, created_at: '2026-09-05T12:01:00Z' },
      { item: 'chain', status: 'withdrawn', ledger_pending: false, created_at: '2026-09-05T11:00:00Z' },
    ]);
    expect(items.find((i) => i.item === 'id_aml')).toMatchObject({ onLedger: true, pending: false });
    expect(items.find((i) => i.item === 'chain')).toMatchObject({ onLedger: false, pending: true, detail: {} });
    expect(items.find((i) => i.item === 'mortgage')).toMatchObject({ onLedger: false, pending: false, detail: { lender_name: 'Halifax' } });
  });

  it('loadBuyerPack reads the status RPC and the ledger under RLS and merges them', async () => {
    mockRpc.mockResolvedValue({ data: [...STATUS], error: null });
    mockFrom.mockReturnValue(ledgerQuery({ data: [{ item: 'id_aml', status: 'ready', ledger_pending: false, created_at: 'x' }], error: null }));
    const items = await loadBuyerPack('tx_1');
    expect(mockRpc).toHaveBeenCalledWith('buyer_pack_status', { p_transaction_id: 'tx_1' });
    expect(mockFrom).toHaveBeenCalledWith('buyer_pack_ledger');
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({ item: 'id_aml', onLedger: true });
  });

  it('loadBuyerPack surfaces a read failure as a BuyerPackError, not as an empty pack', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    mockFrom.mockReturnValue(ledgerQuery({ data: [], error: null }));
    await expect(loadBuyerPack('tx_1')).rejects.toBeInstanceOf(BuyerPackError);
  });

  it('declareBuyerPack posts the declaration and returns the refreshed items', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [{ item: 'chain', status: 'ready', detail: { chain_position: 'none' }, onLedger: true, pending: false }] }, error: null });
    const items = await declareBuyerPack('tx_1', { chainPosition: 'none', linkedTransactionId: null });
    expect(mockInvoke).toHaveBeenCalledWith('buyer-pack', { body: { action: 'declare', transactionId: 'tx_1', declaration: { chainPosition: 'none', linkedTransactionId: null } } });
    expect(items[0]).toMatchObject({ item: 'chain', onLedger: true });
  });

  it('syncBuyerPack posts the sync action', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [] }, error: null });
    expect(await syncBuyerPack('tx_1')).toEqual([]);
    expect(mockInvoke).toHaveBeenCalledWith('buyer-pack', { body: { action: 'sync', transactionId: 'tx_1' } });
  });

  it('a non-2xx becomes a BuyerPackError with the status and the body code', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { status: 403, json: () => Promise.resolve({ error: 'forbidden', reason: 'only the buyer declares' }) } },
    });
    const err = await declareBuyerPack('tx_1', { fundingType: 'cash' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BuyerPackError);
    expect(err).toMatchObject({ status: 403, code: 'forbidden', reason: 'only the buyer declares' });
  });
});
