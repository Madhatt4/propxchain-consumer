// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The Sales pack's inline answers save through Stage 1's path: merge into the
 * stored listing, storeRightmoveData (local + chain), provenance marked as
 * the seller's own. The canister's setListingData writes the audit event.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyListing } from '@/types/listing.types';

const getRightmoveData = vi.fn();
const storeRightmoveData = vi.fn();
vi.mock('@/utils/rightmoveStorage', () => ({
  getRightmoveData: (...a: unknown[]) => getRightmoveData(...a),
  storeRightmoveData: (...a: unknown[]) => storeRightmoveData(...a),
}));

const logEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../icp.service', () => ({ icpService: { ledgerManager: { logEvent: (...a: unknown[]) => logEvent(...a) } } }));

import { saveMaterialInfoPatch } from '../materialInfoSave';

const base = {
  address: '12 High Street, Sandy',
  postcode: 'SG19 1AB',
  price: 400000,
  tenure: 'freehold',
  propertyType: 'Detached',
  councilTaxBand: null,
  provenance: { price: 'adapter' },
} as unknown as PropertyListing;

beforeEach(() => {
  getRightmoveData.mockReset().mockReturnValue(base);
  storeRightmoveData.mockReset().mockResolvedValue({ ok: true });
  logEvent.mockClear();
});

describe('saveMaterialInfoPatch', () => {
  it('should merge the answers into the stored listing and persist it', async () => {
    const result = await saveMaterialInfoPatch('tx-1', { councilTaxBand: 'D' });
    expect(result).toEqual({ isSaved: true, isChainOk: true, error: undefined });
    const [txId, merged] = storeRightmoveData.mock.calls[0] as [string, PropertyListing];
    expect(txId).toBe('tx-1');
    expect(merged).toMatchObject({ address: base.address, price: 400000, councilTaxBand: 'D' });
    expect(merged.provenance).toEqual({ price: 'adapter', councilTaxBand: 'user' });
  });

  it('should write no ledger event from the browser, leaving it to setListingData', async () => {
    await saveMaterialInfoPatch('tx-1', { councilTaxBand: 'D', propertyType: 'Detached' });
    expect(storeRightmoveData).toHaveBeenCalledTimes(1);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('should report a chain failure while keeping the local save', async () => {
    storeRightmoveData.mockResolvedValueOnce({ ok: false, error: 'offline' });
    expect(await saveMaterialInfoPatch('tx-1', { councilTaxBand: 'D' })).toEqual({ isSaved: true, isChainOk: false, error: 'offline' });
  });

  it('should not save when there is no stored listing to merge into', async () => {
    getRightmoveData.mockReturnValueOnce(null);
    expect(await saveMaterialInfoPatch('tx-1', { councilTaxBand: 'D' })).toEqual({ isSaved: false, isChainOk: false });
    expect(storeRightmoveData).not.toHaveBeenCalled();
  });
});
