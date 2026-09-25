// TA6 record service — verifies the two persistence surfaces route to
// document_storage with the right docType and (for the generated record) a
// real non-empty PDF blob. The upload path is mocked; exportTA6ToPDF runs for
// real so the assertion covers the actual generated PDF.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  storeTA6PdfRecord,
  uploadCanonicalTA6,
  TA6_PDF_RECORD_DOC_TYPE,
  TA6_CANONICAL_UPLOAD_DOC_TYPE,
} from '../ta6RecordService';
import { uploadTA6Document } from '../ta6DocumentUpload';
import { emptyTA6Form } from '../../types/ta6.types';
import type { ExportContext } from '../formExportService';

vi.mock('../ta6DocumentUpload', () => ({
  uploadTA6Document: vi.fn(),
}));

const mockedUpload = vi.mocked(uploadTA6Document);

const context: ExportContext = {
  propertyAddress: '10 Example Road, AB1 2CD',
  transactionId: 'tx-1',
};

describe('storeTA6PdfRecord', () => {
  beforeEach(() => {
    mockedUpload.mockReset();
  });

  it('should store the generated PDF under the ta6_pdf_record docType', async () => {
    // Arrange
    mockedUpload.mockResolvedValue('101');

    // Act
    const documentId = await storeTA6PdfRecord('tx-1', emptyTA6Form(), context);

    // Assert
    expect(documentId).toBe('101');
    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [, txId, docType] = mockedUpload.mock.calls[0];
    expect(txId).toBe('tx-1');
    expect(docType).toBe(TA6_PDF_RECORD_DOC_TYPE);
  });

  it('should pass a non-empty application/pdf File to the upload path', async () => {
    // Arrange
    mockedUpload.mockResolvedValue('102');

    // Act
    await storeTA6PdfRecord('tx-2', emptyTA6Form(), { ...context, transactionId: 'tx-2' });

    // Assert
    const [file] = mockedUpload.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe('TA6-tx-2-record.pdf');
    expect(file.size).toBeGreaterThan(500);
  });
});

describe('uploadCanonicalTA6', () => {
  beforeEach(() => {
    mockedUpload.mockReset();
  });

  it('should store a conveyancer file under the ta6_canonical_upload docType', async () => {
    // Arrange
    mockedUpload.mockResolvedValue('202');
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'official-ta6.pdf', {
      type: 'application/pdf',
    });

    // Act
    const documentId = await uploadCanonicalTA6('tx-9', file);

    // Assert
    expect(documentId).toBe('202');
    expect(mockedUpload).toHaveBeenCalledWith(file, 'tx-9', TA6_CANONICAL_UPLOAD_DOC_TYPE);
  });
});
