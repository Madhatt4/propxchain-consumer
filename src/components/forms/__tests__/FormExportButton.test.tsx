import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { FormExportButton } from '../FormExportButton';
import { emptyTA6Form, type TA6PropertyInformation } from '../../../types/ta6.types';

const mockExportTA6 = vi.fn();
const mockExportTA7 = vi.fn();
const mockExportTA10 = vi.fn();
const mockDownloadBlob = vi.fn();

vi.mock('../../../services/formExportService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/formExportService')>(
    '../../../services/formExportService',
  );
  return {
    ...actual,
    exportTA6ToPDF: (...args: unknown[]) => mockExportTA6(...args),
    exportTA7ToPDF: (...args: unknown[]) => mockExportTA7(...args),
    exportTA10ToPDF: (...args: unknown[]) => mockExportTA10(...args),
    downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
  };
});

function sampleTA6(): TA6PropertyInformation {
  const form = emptyTA6Form();
  form.section2.q2_1Features = [{ position: 'left', ownership: 'owned-by-seller' }];
  return form;
}

describe('FormExportButton', () => {
  beforeEach(() => {
    mockExportTA6.mockReset();
    mockExportTA7.mockReset();
    mockExportTA10.mockReset();
    mockDownloadBlob.mockReset();
  });

  it('renders the idle label by default', () => {
    render(
      <FormExportButton
        payload={{ formType: 'TA6', data: sampleTA6() }}
        context={{ propertyAddress: '10 Example Rd' }}
      />,
    );
    expect(screen.getByRole('button', { name: /Export TA6 as PDF/ })).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });

  it('calls exportTA6ToPDF and downloads the blob when clicked', async () => {
    const fakeBlob = new Blob(['x'], { type: 'application/pdf' });
    mockExportTA6.mockResolvedValueOnce(fakeBlob);

    render(
      <FormExportButton
        payload={{ formType: 'TA6', data: sampleTA6() }}
        context={{ propertyAddress: '10 Example Rd', transactionId: 'tx-1' }}
        filename="my-ta6"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Export TA6 as PDF/ }));

    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalled());
    expect(mockExportTA6).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ propertyAddress: '10 Example Rd', transactionId: 'tx-1' }),
      undefined,
    );
    expect(mockDownloadBlob).toHaveBeenCalledWith(fakeBlob, 'my-ta6.pdf');
  });

  it('surfaces an error message when generation fails', async () => {
    mockExportTA6.mockRejectedValueOnce(new Error('bang'));
    render(
      <FormExportButton
        payload={{ formType: 'TA6', data: sampleTA6() }}
        context={{ propertyAddress: '10 Example Rd' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Export TA6 as PDF/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('bang');
  });

  it('routes TA7 payload to exportTA7ToPDF', async () => {
    const fakeBlob = new Blob(['x'], { type: 'application/pdf' });
    mockExportTA7.mockResolvedValueOnce(fakeBlob);
    render(
      <FormExportButton
        payload={{ formType: 'TA7', data: {} as never }}
        context={{ propertyAddress: '' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Export TA7 as PDF/ }));
    await waitFor(() => expect(mockExportTA7).toHaveBeenCalled());
    expect(mockExportTA6).not.toHaveBeenCalled();
  });

  it('routes TA10 payload to exportTA10ToPDF', async () => {
    const fakeBlob = new Blob(['x'], { type: 'application/pdf' });
    mockExportTA10.mockResolvedValueOnce(fakeBlob);
    render(
      <FormExportButton
        payload={{ formType: 'TA10', data: {} as never }}
        context={{ propertyAddress: '' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Export TA10 as PDF/ }));
    await waitFor(() => expect(mockExportTA10).toHaveBeenCalled());
  });
});
