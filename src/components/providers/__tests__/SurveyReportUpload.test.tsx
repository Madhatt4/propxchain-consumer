import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUpload = vi.fn();
const mockScan = vi.fn();
const mockDeclare = vi.fn();
vi.mock('../../../services/surveyDocument.service', () => ({ uploadSurveyReport: (...a: unknown[]) => mockUpload(...a) }));
vi.mock('../../../services/scan.service', () => ({
  fileToBase64: async () => 'cGRm',
  runSurveyScan: (...a: unknown[]) => mockScan(...a),
}));
vi.mock('../../../services/buyerPack.service', () => ({ declareBuyerPack: (...a: unknown[]) => mockDeclare(...a) }));
vi.mock('../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { SurveyReportUpload } from '../SurveyReportUpload';

const HASH = 'a'.repeat(64);

function pickFile(): void {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File(['%PDF-1.4'], 'survey.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('SurveyReportUpload', () => {
  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({ fileHash: HASH });
    mockScan.mockReset().mockResolvedValue({ status: 'complete' });
    mockDeclare.mockReset().mockResolvedValue([]);
  });

  it('should store the report, scan it, mark the survey received and complete the stage', async () => {
    const onUploaded = vi.fn();
    render(<SurveyReportUpload transactionId="tx_1" onUploaded={onUploaded} />);

    pickFile();

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(HASH));
    expect(mockScan).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'tx_1', filename: 'survey.pdf', contentBase64: 'cGRm' }));
    expect(mockDeclare).toHaveBeenCalledWith('tx_1', { surveyReceived: true });
    expect(screen.getByText('Scanned. The findings are in the AI scans tab.')).toBeInTheDocument();
  });

  it('should keep the upload and still complete the stage when the scan does not run', async () => {
    mockScan.mockResolvedValue(null);
    const onUploaded = vi.fn();
    render(<SurveyReportUpload transactionId="tx_1" onUploaded={onUploaded} />);

    pickFile();

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(screen.getByText('Uploaded. The scan did not run; you can scan it from the AI scans tab.')).toBeInTheDocument();
  });

  it('should not complete the stage when the upload itself fails', async () => {
    mockUpload.mockRejectedValue(new Error('Not a PDF'));
    const onUploaded = vi.fn();
    render(<SurveyReportUpload transactionId="tx_1" onUploaded={onUploaded} />);

    pickFile();

    expect(await screen.findByRole('alert')).toHaveTextContent('Not a PDF');
    expect(onUploaded).not.toHaveBeenCalled();
    expect(mockScan).not.toHaveBeenCalled();
    expect(mockDeclare).not.toHaveBeenCalled();
  });
});
