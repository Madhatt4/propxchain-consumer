// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Two clicks to remove, one to back out, and a failure that leaves the
 * upload in place with the reason on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockWithdraw = vi.fn();

vi.mock('@/services/completedFormUpload.service', () => ({
  withdrawCompletedForm: (...args: unknown[]) => mockWithdraw(...args),
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { RemoveFormUpload } from '../../../components/propertyInfo/RemoveFormUpload';

function renderControl(onRemoved = vi.fn()): ReturnType<typeof vi.fn> {
  render(<RemoveFormUpload transactionId="tx_1" formId="ta6" formLabel="TA6 Property Information Form" onRemoved={onRemoved} />);
  return onRemoved;
}

describe('RemoveFormUpload', () => {
  beforeEach(() => {
    mockWithdraw.mockReset();
  });

  it('should ask before removing and do nothing on the first click', () => {
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Remove upload' }));

    expect(screen.getByText(/Remove the PDF you uploaded as your TA6 Property Information Form/)).toBeInTheDocument();
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('should remove on confirmation and tell the stage', async () => {
    mockWithdraw.mockResolvedValue({ removed: 1 });
    const onRemoved = renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Remove upload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(mockWithdraw).toHaveBeenCalledWith('tx_1', 'ta6');
  });

  it('should back out without removing when the seller keeps it', () => {
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Remove upload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.getByRole('button', { name: 'Remove upload' })).toBeInTheDocument();
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('should show the reason and keep the upload when removal fails', async () => {
    mockWithdraw.mockRejectedValue(new Error('Only the seller or their solicitor can withdraw a form upload'));
    const onRemoved = renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Remove upload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Only the seller or their solicitor/);
    expect(onRemoved).not.toHaveBeenCalled();
  });
});
