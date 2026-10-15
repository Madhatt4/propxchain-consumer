// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc, mockRecord } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockRecord: vi.fn() }));

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
vi.mock('../icp.service', () => ({
  icpService: { recordDocumentFact: (...a: unknown[]) => mockRecord(...a) },
}));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { decideFact, factLabel, loadCurrentFacts } from '../documentFacts.service';

const HASH = 'a'.repeat(64);
const ROW = { fact_key: 'gas_safety.passed', value: 'true', source_sha256: HASH };

describe('factLabel', () => {
  it("should put a fact in the seller's words", () => {
    expect(factLabel({ factKey: 'gas_safety.passed', value: 'true', method: 'jev' })).toBe(
      'Every gas appliance passed',
    );
    expect(factLabel({ factKey: 'eicr.satisfactory', value: 'false', method: 'jev' })).toBe(
      'Electrics rated unsatisfactory',
    );
    expect(factLabel({ factKey: 'epc.band', value: 'C', method: 'jev' })).toBe('EPC rating C');
  });

  it("should say a photo's in-date was judged on the day it was checked", () => {
    expect(factLabel({ factKey: 'gas_safety.in_date', value: 'true', method: 'jev' })).toBe(
      'Gas safety record is in date (checked today)',
    );
    expect(factLabel({ factKey: 'gas_safety.in_date', value: 'true', method: 'code' })).toBe(
      'Gas safety record is in date',
    );
  });
});

describe('decideFact', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRecord.mockReset();
  });

  it('should save the confirmation, then record the key, value and file hash on-chain', async () => {
    mockRpc.mockResolvedValue({ data: ROW, error: null });
    mockRecord.mockResolvedValue(undefined);

    const result = await decideFact('tx-1', 'fact-9', 'confirmed');

    expect(mockRpc).toHaveBeenCalledWith('confirm_document_fact', {
      p_fact_id: 'fact-9',
      p_decision: 'confirmed',
    });
    expect(mockRecord).toHaveBeenCalledWith('tx-1', 'gas_safety.passed', 'true', HASH);
    expect(result).toEqual({ decision: 'confirmed', anchored: true });
  });

  it('should record a rejection on-chain as the value "rejected"', async () => {
    mockRpc.mockResolvedValue({ data: ROW, error: null });

    await decideFact('tx-1', 'fact-9', 'rejected');

    expect(mockRecord).toHaveBeenCalledWith('tx-1', 'gas_safety.passed', 'rejected', HASH);
  });

  it('should throw a seller-facing message and touch nothing on-chain when the database refuses', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });

    await expect(decideFact('tx-1', 'fact-9', 'confirmed')).rejects.toThrow(
      'Only the seller can confirm these.',
    );
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('should keep the saved decision and report it unanchored when the canister call fails', async () => {
    mockRpc.mockResolvedValue({ data: ROW, error: null });
    mockRecord.mockRejectedValue(new Error('canister down'));

    expect(await decideFact('tx-1', 'fact-9', 'confirmed')).toEqual({
      decision: 'confirmed',
      anchored: false,
    });
  });
});

describe('loadCurrentFacts', () => {
  beforeEach(() => mockRpc.mockReset());

  it('should map the current facts for the transaction', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          fact_key: 'epc.band',
          value: 'C',
          method: 'jev',
          status: 'confirmed',
          storage_path: 'transactions/tx/ta6/abc.jpg',
          checked_at: '2026-10-15T09:00:00Z',
          decided_at: '2026-10-15T10:00:00Z',
        },
      ],
      error: null,
    });

    const facts = await loadCurrentFacts('tx-1');

    expect(mockRpc).toHaveBeenCalledWith('document_facts_current', { p_transaction_id: 'tx-1' });
    expect(facts).toEqual([
      {
        factKey: 'epc.band',
        value: 'C',
        method: 'jev',
        status: 'confirmed',
        storagePath: 'transactions/tx/ta6/abc.jpg',
        checkedAt: '2026-10-15T09:00:00Z',
        decidedAt: '2026-10-15T10:00:00Z',
      },
    ]);
  });

  it('should resolve empty, never reject, when the database errors or the client throws', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await loadCurrentFacts('tx-1')).toEqual([]);

    mockRpc.mockImplementationOnce(() => {
      throw new Error('no client');
    });
    expect(await loadCurrentFacts('tx-1')).toEqual([]);
  });
});
