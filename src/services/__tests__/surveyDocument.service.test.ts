import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadFundingDocument = vi.fn();
vi.mock('../fundingDocument.service', () => ({
  fundingDocumentService: {
    uploadFundingDocument: (...a: unknown[]) => uploadFundingDocument(...a),
  },
}));

import {
  uploadSurveyReport,
  SURVEY_REPORT_DOC_TYPE,
  MAX_SURVEY_BYTES,
} from '../surveyDocument.service';

const RECORD = {
  storageDocId: 1,
  verificationDocId: 2,
  fileHash: 'a'.repeat(64),
  storageLocation: 'supabase://propxchain-documents/x',
  fileName: 'survey.pdf',
  fileSize: 512,
  contentType: 'application/pdf',
};

/** A File whose bytes genuinely start with the `%PDF-` signature. */
function pdfFile(size = 512, name = 'survey.pdf'): File {
  const bytes = new Uint8Array(size);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return new File([bytes], name, { type: 'application/pdf' });
}

describe('uploadSurveyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFundingDocument.mockResolvedValue(RECORD);
  });

  it('should store a valid PDF under the survey folder and document type', async () => {
    const file = pdfFile();

    const result = await uploadSurveyReport(file, { transactionId: 'tx_5' });

    expect(uploadFundingDocument).toHaveBeenCalledWith(file, {
      transactionId: 'tx_5',
      propertyId: undefined,
      documentType: SURVEY_REPORT_DOC_TYPE,
      folder: 'survey',
    });
    expect(result).toEqual(RECORD);
  });

  it('should pass the property id through when supplied', async () => {
    await uploadSurveyReport(pdfFile(), { transactionId: 'tx_5', propertyId: 42 });

    expect(uploadFundingDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ propertyId: 42 }),
    );
  });

  it('should reject a non-PDF before anything reaches storage', async () => {
    const notPdf = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'survey.pdf', {
      type: 'application/pdf',
    });

    await expect(uploadSurveyReport(notPdf, { transactionId: 'tx_5' })).rejects.toThrow(
      /doesn't look like a PDF/,
    );
    expect(uploadFundingDocument).not.toHaveBeenCalled();
  });

  it('should reject a file over the size limit before anything reaches storage', async () => {
    const tooBig = pdfFile(MAX_SURVEY_BYTES + 1);

    await expect(uploadSurveyReport(tooBig, { transactionId: 'tx_5' })).rejects.toThrow(
      /too large/,
    );
    expect(uploadFundingDocument).not.toHaveBeenCalled();
  });

  it('should surface an upload failure to the caller', async () => {
    uploadFundingDocument.mockRejectedValue(new Error('Secure upload failed: boom'));

    await expect(uploadSurveyReport(pdfFile(), { transactionId: 'tx_5' })).rejects.toThrow(
      'Secure upload failed: boom',
    );
  });
});
