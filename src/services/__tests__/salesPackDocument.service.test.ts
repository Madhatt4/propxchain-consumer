// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadFundingDocument = vi.fn();
const getDocumentsByTransaction = vi.fn();
const download = vi.fn();
const from = vi.fn((_bucket: string) => ({ download }));

vi.mock('../fundingDocument.service', () => ({
  fundingDocumentService: {
    uploadFundingDocument: (...a: unknown[]) => uploadFundingDocument(...a),
  },
}));
vi.mock('../icp.service', () => ({
  icpService: { getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a) },
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { storage: { from: (bucket: string) => from(bucket) } },
}));

import {
  MAX_SALES_PACK_BYTES,
  SALES_PACK_FOLDER,
  fetchSalesPackFile,
  listSalesPackDocuments,
  packDownloadName,
  uploadSalesPackDocument,
  validateSalesPackFile,
  type SalesPackDocument,
} from '../salesPackDocument.service';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const LOCATION = 'supabase://propxchain-documents/transactions/tx_5/sales-pack/sales_pack_floor_plan-abc.pdf';

function fileWith(magic: number[], type: string, size = 512, name = 'plan.pdf'): File {
  const bytes = new Uint8Array(size);
  bytes.set(magic.slice(0, size));
  return new File([bytes], name, { type });
}

const RECORD = {
  storageDocId: 1,
  verificationDocId: 2,
  fileHash: 'a'.repeat(64),
  storageLocation: LOCATION,
  fileName: 'plan.pdf',
  fileSize: 512,
  contentType: 'application/pdf',
};

describe('uploadSalesPackDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFundingDocument.mockResolvedValue(RECORD);
  });

  it('should store a valid file under the sales-pack folder with the pack kind as docType', async () => {
    const file = fileWith(PDF_MAGIC, 'application/pdf');

    const result = await uploadSalesPackDocument(file, { transactionId: 'tx_5', kind: 'sales_pack_floor_plan' });

    expect(uploadFundingDocument).toHaveBeenCalledWith(file, {
      transactionId: 'tx_5',
      propertyId: undefined,
      documentType: 'sales_pack_floor_plan',
      folder: SALES_PACK_FOLDER,
    });
    expect(SALES_PACK_FOLDER).toBe('sales-pack');
    expect(result).toEqual(RECORD);
  });

  it('should accept a real PNG', async () => {
    await uploadSalesPackDocument(fileWith(PNG_MAGIC, 'image/png', 64, 'epc.png'), {
      transactionId: 'tx_5',
      kind: 'sales_pack_epc',
    });

    expect(uploadFundingDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ documentType: 'sales_pack_epc' }),
    );
  });

  it('should refuse an identity document as a pack kind before anything reaches storage', async () => {
    await expect(
      uploadSalesPackDocument(fileWith(PDF_MAGIC, 'application/pdf'), { transactionId: 'tx_5', kind: 'identity_document' }),
    ).rejects.toThrow(/Choose a document type/);
    expect(uploadFundingDocument).not.toHaveBeenCalled();
  });

  it('should refuse a file over 10MB before anything reaches storage', async () => {
    const big = fileWith(PDF_MAGIC, 'application/pdf', MAX_SALES_PACK_BYTES + 1);

    await expect(uploadSalesPackDocument(big, { transactionId: 'tx_5', kind: 'sales_pack_eicr' })).rejects.toThrow(/10MB/);
    expect(uploadFundingDocument).not.toHaveBeenCalled();
  });

  it('should surface the storage error message when the upload fails', async () => {
    uploadFundingDocument.mockRejectedValue(new Error('Secure upload failed: new row violates row-level security policy'));

    await expect(
      uploadSalesPackDocument(fileWith(PDF_MAGIC, 'application/pdf'), { transactionId: 'tx_5', kind: 'sales_pack_fensa' }),
    ).rejects.toThrow(/Secure upload failed/);
  });
});

describe('validateSalesPackFile', () => {
  it('should reject a type outside PDF, JPG and PNG', async () => {
    expect(await validateSalesPackFile(fileWith([0x50, 0x4b], 'application/zip'))).toBe('PDF, JPG or PNG only.');
  });

  it('should reject a file whose bytes do not match its claimed type', async () => {
    expect(await validateSalesPackFile(fileWith(PNG_MAGIC, 'application/pdf'))).toMatch(/doesn't look like/);
  });

  it('should reject an empty file', async () => {
    expect(await validateSalesPackFile(new File([], 'empty.pdf', { type: 'application/pdf' }))).toMatch(/empty/);
  });

  it('should accept image/jpg as JPEG when the bytes are a real JPEG', async () => {
    expect(await validateSalesPackFile(fileWith([0xff, 0xd8, 0xff, 0xe0], 'image/jpg', 64, 'plan.jpg'))).toBeNull();
  });

  it('should reject image/jpg when the bytes are not a JPEG', async () => {
    expect(await validateSalesPackFile(fileWith(PDF_MAGIC, 'image/jpg', 64, 'plan.jpg'))).toMatch(/doesn't look like/);
  });

  it('should pass a genuine PDF', async () => {
    expect(await validateSalesPackFile(fileWith(PDF_MAGIC, 'application/pdf'))).toBeNull();
  });
});

describe('listSalesPackDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should keep only server-held pack documents, newest first, labelled by kind', async () => {
    getDocumentsByTransaction.mockResolvedValue([
      { id: 'doc_1', type: 'sales_pack_epc', fileName: 'sales_pack_epc.pdf', uploadedAt: '2026-11-01T10:00:00.000Z', storageLocation: LOCATION, hash: 'h1', contentType: 'application/pdf' },
      { id: 'doc_2', type: 'mortgageAgreement', fileName: 'mortgageAgreement.pdf', uploadedAt: '2026-11-02T10:00:00.000Z', storageLocation: LOCATION },
      { id: 'doc_3', type: 'sales_pack_floor_plan', fileName: 'sales_pack_floor_plan.png', uploadedAt: '2026-11-09T10:00:00.000Z', storageLocation: LOCATION, hash: 'h3', contentType: 'image/png' },
      { id: 'doc_4', type: 'sales_pack_lease', fileName: 'sales_pack_lease.pdf', uploadedAt: '2026-11-03T10:00:00.000Z', storageLocation: 'onchain' },
    ]);

    const docs = await listSalesPackDocuments('tx_5');

    expect(getDocumentsByTransaction).toHaveBeenCalledWith('tx_5');
    expect(docs.map((d) => [d.id, d.label])).toEqual([
      ['doc_3', 'Floor plan'],
      ['doc_1', 'EPC certificate'],
    ]);
  });

  it('should throw when the chain lookup fails, so the UI can say it could not load', async () => {
    getDocumentsByTransaction.mockRejectedValue(new Error('canister unreachable'));

    await expect(listSalesPackDocuments('tx_5')).rejects.toThrow(/canister unreachable/);
  });
});

describe('fetchSalesPackFile', () => {
  const doc: SalesPackDocument = {
    id: 'doc_3',
    kind: 'sales_pack_floor_plan',
    label: 'Floor plan',
    fileName: 'sales_pack_floor_plan.pdf',
    uploadedAt: null,
    storageLocation: LOCATION,
    fileHash: 'h3',
    contentType: 'application/pdf',
  };

  beforeEach(() => vi.clearAllMocks());

  it('should download from the bucket and path the storage location names', async () => {
    const blob = new Blob(['x']);
    download.mockResolvedValue({ data: blob, error: null });

    expect(await fetchSalesPackFile(doc)).toBe(blob);
    expect(from).toHaveBeenCalledWith('propxchain-documents');
    expect(download).toHaveBeenCalledWith('transactions/tx_5/sales-pack/sales_pack_floor_plan-abc.pdf');
  });

  it('should explain when storage refuses the read', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });

    await expect(fetchSalesPackFile(doc)).rejects.toThrow(/can't be opened from your account/);
  });

  it('should refuse a document with no server copy', async () => {
    await expect(fetchSalesPackFile({ ...doc, storageLocation: 'onchain' })).rejects.toThrow(/no stored copy/);
    expect(download).not.toHaveBeenCalled();
  });
});

describe('packDownloadName', () => {
  const base: SalesPackDocument = {
    id: 'doc_3',
    kind: 'sales_pack_floor_plan',
    label: 'Floor plan',
    fileName: 'sales_pack_floor_plan.pdf',
    uploadedAt: null,
    storageLocation: LOCATION,
    fileHash: 'abcdef1234567890',
    contentType: 'application/pdf',
  };

  it('should name the copy by type and short hash with the on-chain extension', () => {
    expect(packDownloadName(base)).toBe('Floor-plan-abcdef12.pdf');
  });

  it('should take the extension from the content type when the name has none', () => {
    expect(packDownloadName({ ...base, fileName: 'sales_pack_floor_plan', contentType: 'image/png' })).toBe(
      'Floor-plan-abcdef12.png',
    );
  });

  it('should fall back to the blob type when the row has no usable content type', () => {
    expect(packDownloadName({ ...base, fileName: 'sales_pack_floor_plan', contentType: '' }, 'image/jpeg')).toBe(
      'Floor-plan-abcdef12.jpg',
    );
  });

  it('should leave the extension off when nothing says what the file is', () => {
    expect(packDownloadName({ ...base, fileName: 'sales_pack_floor_plan', contentType: '' })).toBe('Floor-plan-abcdef12');
  });
});
