// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeMock, downloadMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  downloadMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    storage: { from: () => ({ download: downloadMock }) },
  },
}));

import {
  buildManualSearchBundle,
  runSearchScan,
  runSurveyScan,
  getHmlrScan,
  storedDocToBase64,
} from './scan.service';
import type { HmlrRegisterExtract } from './hmlrTitle.service';
import type { ScanResult, HmlrScanResult } from '../types/scan.types';

const searchResult: ScanResult = {
  scan_type: 'search',
  source_ref: 'search:tx1:llc1.pdf',
  findings: [
    { key: 'flood_risk_surface_water', label: 'Surface-water flood risk', value: 'Low', personal_data: false, confidence: 'high', provenance: 'CON29' },
  ],
  explainer: 'Your searches look clear.',
  flags_for_conveyancer: [],
};

const hmlrScan: HmlrScanResult = {
  titleNumber: 'GR506405',
  editionDate: '2025-11-02',
  scannedAt: '2026-07-18T10:00:00Z',
  model: 'claude-sonnet-4-6',
  schemaVersion: 1,
  enrichment: { classOfTitle: 'Absolute', tenure: 'Freehold', chargesCount: 0, hasRestrictions: false, leaseCount: 0 },
  findings: [],
  sellerSummary: 'Freehold, no charges.',
  headlineFlags: [],
};

describe('buildManualSearchBundle', () => {
  it('should wrap the manual PDF as a single-document Groundsure bundle', () => {
    const bundle = buildManualSearchBundle('QkFTRTY0', 'llc1.pdf');
    expect(bundle.reports).toHaveLength(1);
    expect(bundle.reports[0]).toMatchObject({
      productType: 'LLC1CON29',
      contentBase64: 'QkFTRTY0',
      mimeType: 'application/pdf',
      filename: 'llc1.pdf',
    });
  });

  it('should omit filename when not provided and honour a custom productType', () => {
    const bundle = buildManualSearchBundle('QkFTRTY0', undefined, 'ENVRES');
    expect(bundle.reports[0].productType).toBe('ENVRES');
    expect('filename' in bundle.reports[0]).toBe(false);
  });
});

describe('runSearchScan', () => {
  beforeEach(() => invokeMock.mockReset());

  it('should invoke search-scan with the groundsure bundle and return complete', async () => {
    invokeMock.mockResolvedValueOnce({ data: { cached: false, scan: searchResult }, error: null });
    const out = await runSearchScan({ sourceRef: 'search:tx1:llc1.pdf', contentBase64: 'QkFTRTY0', filename: 'llc1.pdf', propertyRef: '100012345' });
    expect(out).toEqual({ status: 'complete', result: searchResult });
    expect(invokeMock).toHaveBeenCalledWith('search-scan', {
      body: expect.objectContaining({
        provider: 'groundsure',
        sourceRef: 'search:tx1:llc1.pdf',
        propertyRef: '100012345',
        bundle: expect.objectContaining({ reports: expect.any(Array) }),
      }),
    });
  });

  // A search we ordered comes back as a multi-product PISCES bundle. Routing it
  // through the manual (groundsure) path would flatten it and mislabel each
  // document, so the provider's own normaliser has to be reachable.
  it('should invoke search-scan with the onesearch provider for a returned bundle', async () => {
    invokeMock.mockResolvedValueOnce({ data: { cached: false, scan: searchResult }, error: null });
    const bundle = {
      products: [
        { productType: 'ONESEARCHDW', attachments: [{ contentBase64: 'QQ==', format: 'application/pdf' }] },
      ],
    };

    const out = await runSearchScan({
      sourceRef: 'search:onesearch:propxchain-2026-07-27-abc',
      transactionId: 'tx1',
      provider: 'onesearch',
      bundle,
    });

    expect(out).toEqual({ status: 'complete', result: searchResult });
    expect(invokeMock).toHaveBeenCalledWith('search-scan', {
      body: {
        provider: 'onesearch',
        sourceRef: 'search:onesearch:propxchain-2026-07-27-abc',
        transactionId: 'tx1',
        bundle,
      },
    });
  });

  it('should surface an unsupported status', async () => {
    const unsupported: ScanResult = { ...searchResult, findings: [], explainer: 'not supported' };
    invokeMock.mockResolvedValueOnce({ data: { status: 'unsupported', scan: unsupported }, error: null });
    const out = await runSearchScan({ sourceRef: 'x', contentBase64: 'QkFTRTY0' });
    expect(out?.status).toBe('unsupported');
  });

  it('should return null on edge-function error', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await runSearchScan({ sourceRef: 'x', contentBase64: 'QkFTRTY0' })).toBeNull();
  });

  it('should return null when invoke throws', async () => {
    invokeMock.mockRejectedValueOnce(new Error('network'));
    expect(await runSearchScan({ sourceRef: 'x', contentBase64: 'QkFTRTY0' })).toBeNull();
  });
});

describe('runSurveyScan', () => {
  beforeEach(() => invokeMock.mockReset());

  it('should invoke survey-scan with base64 content + media type', async () => {
    const surveyResult: ScanResult = { ...searchResult, scan_type: 'survey' };
    invokeMock.mockResolvedValueOnce({ data: { scan: surveyResult }, error: null });
    const out = await runSurveyScan({ sourceRef: 'survey:tx1:s.pdf', contentBase64: 'UERG', filename: 's.pdf', ricsLevel: 2 });
    expect(out?.status).toBe('complete');
    expect(invokeMock).toHaveBeenCalledWith('survey-scan', {
      body: expect.objectContaining({
        sourceRef: 'survey:tx1:s.pdf',
        contentBase64: 'UERG',
        mediaType: 'application/pdf',
        ricsLevel: 2,
      }),
    });
  });

  it('should return null on error', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await runSurveyScan({ sourceRef: 'x', contentBase64: 'UERG' })).toBeNull();
  });
});

describe('getHmlrScan', () => {
  beforeEach(() => invokeMock.mockReset());
  const register = { titleNumber: 'GR506405', editionDate: '2025-11-02', typeCode: 30 } as unknown as HmlrRegisterExtract;

  it('should invoke hmlr-scan with the register and return the raw scan', async () => {
    invokeMock.mockResolvedValueOnce({ data: { cached: true, scan: hmlrScan }, error: null });
    const out = await getHmlrScan(register, 'tx1');
    expect(out).toEqual(hmlrScan);
    expect(invokeMock).toHaveBeenCalledWith('hmlr-scan', { body: { register, transactionId: 'tx1' } });
  });

  it('should return null for a no-register-data response (no scan key)', async () => {
    invokeMock.mockResolvedValueOnce({ data: { cached: false, status: 'no_register_data' }, error: null });
    expect(await getHmlrScan(register)).toBeNull();
  });

  it('should return null on error', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await getHmlrScan(register)).toBeNull();
  });
});

describe('storedDocToBase64', () => {
  beforeEach(() => downloadMock.mockReset());

  it('should download and base64-encode the stored bytes', async () => {
    const blob = { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    downloadMock.mockResolvedValueOnce({ data: blob, error: null });
    expect(await storedDocToBase64('propxchain-documents', 'transactions/tx1/x.pdf')).toBe('AQID');
  });

  it('should return null when the download errors', async () => {
    downloadMock.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    expect(await storedDocToBase64('b', 'p')).toBeNull();
  });

  it('should return null when download throws', async () => {
    downloadMock.mockRejectedValueOnce(new Error('network'));
    expect(await storedDocToBase64('b', 'p')).toBeNull();
  });
});
