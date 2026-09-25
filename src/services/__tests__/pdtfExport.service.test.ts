// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The browser never maps to PDTF itself: it asks the edge function as the
 * signed-in party and downloads what comes back. These tests pin the request
 * shape, the error translation and the file name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import {
  DOWNLOAD_COUNTERPARTY,
  PdtfExportError,
  exportPdtf,
  pdtfFileName,
  type PdtfExportResponse,
} from '../pdtfExport.service';

function response(overrides: Partial<PdtfExportResponse> = {}): PdtfExportResponse {
  return {
    transaction: { propertyPack: { address: { postcode: 'SG19 1AB' } } },
    claims: [],
    claimSetHash: '4625ca88deadbeef',
    coverage: { core: true },
    omissions: [],
    validation: {},
    ledger: { recorded: true },
    generator: {},
    ...overrides,
  };
}

describe('pdtfExport.service', () => {
  beforeEach(() => mockInvoke.mockReset());

  it('should call pdtf-export with the transaction id and the download counterparty', async () => {
    mockInvoke.mockResolvedValue({ data: response(), error: null });
    const out = await exportPdtf('tx_1');
    expect(mockInvoke).toHaveBeenCalledWith('pdtf-export', {
      body: { transactionId: 'tx_1', counterparty: DOWNLOAD_COUNTERPARTY },
    });
    expect(out.claimSetHash).toBe('4625ca88deadbeef');
  });

  it('should surface the function status and error code when it refuses', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'boom', context: { status: 403, json: () => Promise.resolve({ error: 'forbidden' }) } },
    });
    await expect(exportPdtf('tx_1')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('should fall back to the transport message when the error body is not JSON', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Failed to send a request', context: { status: 0, json: () => Promise.reject(new Error('no body')) } },
    });
    const err = await exportPdtf('tx_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PdtfExportError);
    expect((err as PdtfExportError).code).toBe('Failed to send a request');
  });

  it('should reject an empty body rather than download nothing', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(exportPdtf('tx_1')).rejects.toMatchObject({ code: 'empty response' });
  });

  it('should name the file by compact postcode and the first eight hash characters', () => {
    expect(pdtfFileName(response())).toBe('pdtf-SG191AB-4625ca88.json');
  });

  it('should fall back to "property" when the export carries no postcode', () => {
    expect(pdtfFileName(response({ transaction: {} }))).toBe('pdtf-property-4625ca88.json');
  });
});
