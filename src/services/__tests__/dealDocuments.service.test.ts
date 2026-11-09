// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocumentsByTransaction = vi.fn();
const getTransaction = vi.fn();
const rpc = vi.fn();
const download = vi.fn();
const from = vi.fn((_bucket: string) => ({ download }));

vi.mock('../icp.service', () => ({
  icpService: {
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
    getTransaction: (...a: unknown[]) => getTransaction(...a),
  },
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), storage: { from: (b: string) => from(b) } },
}));
vi.mock('../../stores/authStore', () => ({ getStorePrincipalId: () => 'ME' }));

import {
  CANNOT_OPEN_YET,
  dealDocDownloadName,
  fetchDealDocumentFile,
  fetchDealSurveyScans,
  listDealDocuments,
  loadUploaderLabels,
  roleLabel,
  type DealDocument,
} from '../dealDocuments.service';

const DOC: DealDocument = {
  id: 'doc_1', group: 'survey', docType: 'surveyReport', typeLabel: 'Survey report',
  fileName: 'surveyReport.pdf', uploadedByLabel: 'Buyer', uploadedAt: null,
  storageLocation: 'supabase://propxchain-documents/transactions/tx_1/survey/abc.pdf',
  canOpen: true, fileHash: 'abcdef1234567890', contentType: 'application/pdf',
};

describe('roleLabel', () => {
  it('should name a conveyancer by the side they act for', () => {
    expect(roleLabel('conveyancer', 'buyer')).toBe("Buyer's conveyancer");
    expect(roleLabel('conveyancer', null)).toBe('Conveyancer');
    expect(roleLabel('estate_agent', 'seller')).toBe('Estate agent');
  });

  it('should fall back to a neutral label for an unknown role', () => {
    expect(roleLabel('mortgage_broker', null)).toBe('Party on the deal');
  });
});

describe('loadUploaderLabels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should not call the buyer slot a buyer when it holds the seller', async () => {
    getTransaction.mockResolvedValue({ seller: 'S', buyer: 'S' });
    rpc.mockResolvedValue({ data: [], error: null });
    const labels = await loadUploaderLabels('tx_1', ['S']);
    expect(labels.get('S')).toBe('Seller');
  });

  it('should return what it has when the transaction read fails', async () => {
    getTransaction.mockRejectedValue(new Error('down'));
    expect((await loadUploaderLabels('tx_1', ['X'])).size).toBe(0);
  });
});

describe('listDealDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should mark the caller\'s own uploads and sort newest first', async () => {
    getTransaction.mockResolvedValue({ seller: 'S', buyer: 'ME' });
    rpc.mockResolvedValue({ data: [], error: null });
    getDocumentsByTransaction.mockResolvedValue([
      { id: 'doc_1', type: 'ta6_attachment', uploadedBy: 'S', uploadedAt: '2026-11-01', storageLocation: 'onchain' },
      { id: 'doc_2', type: 'surveyReport', uploadedBy: 'ME', uploadedAt: '2026-11-02', storageLocation: DOC.storageLocation },
    ]);
    const docs = await listDealDocuments('tx_1');
    expect(docs.map((d) => d.id)).toEqual(['doc_2', 'doc_1']);
    expect(docs[0].uploadedByLabel).toBe('Buyer (you)');
    expect(docs[1].canOpen).toBe(false);
  });

  it('should throw when the list itself fails', async () => {
    getDocumentsByTransaction.mockRejectedValue(new Error('down'));
    await expect(listDealDocuments('tx_1')).rejects.toThrow('down');
  });
});

describe('fetchDealDocumentFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should download from the bucket and path in the storage location', async () => {
    const blob = new Blob(['x']);
    download.mockResolvedValue({ data: blob, error: null });
    expect(await fetchDealDocumentFile(DOC)).toBe(blob);
    expect(from).toHaveBeenCalledWith('propxchain-documents');
    expect(download).toHaveBeenCalledWith('transactions/tx_1/survey/abc.pdf');
  });

  it('should throw the "can\'t be opened yet" message when storage refuses', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    await expect(fetchDealDocumentFile(DOC)).rejects.toThrow(CANNOT_OPEN_YET);
  });
});

describe('dealDocDownloadName', () => {
  it('should build the name from the type label and hash, not the filename', () => {
    expect(dealDocDownloadName({ ...DOC, fileName: 'Jane Smith survey.pdf' })).toBe('Survey-report-abcdef12.pdf');
  });
});

describe('fetchDealSurveyScans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return null when the RPC is missing', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect(await fetchDealSurveyScans('tx_1')).toBeNull();
  });

  it('should skip rows that are not finished scans', async () => {
    rpc.mockResolvedValue({
      data: [
        { status: 'pending', findings: [], explainer: null, flags_for_conveyancer: [], personal_findings_count: 0 },
        { status: 'complete', findings: [], explainer: 'ok', flags_for_conveyancer: [], personal_findings_count: 1 },
      ],
      error: null,
    });
    const scans = await fetchDealSurveyScans('tx_1');
    expect(scans).toHaveLength(1);
    expect(scans?.[0].personalFindingsCount).toBe(1);
  });
});
