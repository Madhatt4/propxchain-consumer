// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// Marc's 16 Oct run: an EICR attached to 11.4, its facts confirmed, then a
// reload showed no attachment and a blank 11.3, because nothing had been saved.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type * as DocumentFactsService from '../../../services/documentFacts.service';

const { mockLoadFacts } = vi.hoisted(() => ({ mockLoadFacts: vi.fn() }));

vi.mock('../FormExportButton', () => ({
  FormExportButton: () => <div data-testid="form-export-stub" />,
}));

vi.mock('../../../services/documentFacts.service', async (importOriginal) => ({
  ...(await importOriginal<typeof DocumentFactsService>()),
  loadCurrentFacts: (...a: unknown[]) => mockLoadFacts(...a),
}));

import TA6Form from '../TA6Form';
import type { TA6PropertyInformation } from '../../../types/ta6.types';
import type { DocFact } from '../../../services/documentFacts.service';

const IN_DATE: DocFact = { id: 'f1', factKey: 'eicr.in_date', value: 'true', confidence: 0.98, method: 'jev', validUntil: '2031-09-12' };

function eicrUpload(decide = vi.fn().mockResolvedValue({ decision: 'confirmed', anchored: true })) {
  return vi.fn().mockResolvedValue({
    documentId: '46',
    classification: Promise.resolve(null),
    facts: Promise.resolve([IN_DATE]),
    decide,
  });
}

function pickFileIn11_4(): void {
  fireEvent.change(screen.getByLabelText('11.4.doc attachment'), {
    target: { files: [new File(['x'], 'eicr.png', { type: 'image/png' })] },
  });
}

describe('TA6Form attachments', () => {
  beforeEach(() => mockLoadFacts.mockReset().mockResolvedValue([]));

  it('should save the form as soon as a file is attached, with the attachment in it', async () => {
    // Arrange
    const onSave = vi.fn<(data: TA6PropertyInformation) => Promise<void>>().mockResolvedValue(undefined);
    render(<TA6Form transactionId="tx-1" initialData={null} onSave={onSave} uploadFile={eicrUpload()} initialStep={11} />);

    // Act
    pickFileIn11_4();

    // Assert
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].section11.q11_4HeatingSystems[0].certificate).toEqual({
      status: 'attached',
      documentId: '46',
    });
  });

  it('should answer 11.3 Yes as soon as the seller confirms an EICR fact on the upload', async () => {
    // Arrange: nothing confirmed when the form loads; confirmed once the seller clicks.
    mockLoadFacts.mockResolvedValueOnce([]).mockResolvedValue([
      { ...IN_DATE, status: 'confirmed', storagePath: 'p', checkedAt: '2026-10-16T14:37:57Z', decidedAt: '2026-10-16T14:40:23Z' },
    ]);
    render(<TA6Form transactionId="tx-1" initialData={null} onSave={vi.fn().mockResolvedValue(undefined)} uploadFile={eicrUpload()} initialStep={11} />);
    pickFileIn11_4();

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /^Confirm:/ }));

    // Assert: 11.3 now reads Yes, so its report-date follow-up and the suggested badge appear.
    expect(await screen.findByText(/Suggested from your upload/)).toBeInTheDocument();
    expect(screen.getByLabelText('Date of most recent report')).toBeInTheDocument();
  });
});
