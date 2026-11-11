// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetDepositSent = vi.fn();
const mockGetRegistrationStatus = vi.fn();
vi.mock('@/services/icp.service', () => ({
  icpService: {
    getDepositSent: (...a: unknown[]) => mockGetDepositSent(...a),
    getRegistrationStatus: (...a: unknown[]) => mockGetRegistrationStatus(...a),
  },
}));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { ConveyancerRecordRows } from '../completion/ConveyancerRecordRows';

describe('ConveyancerRecordRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show the deposit sent and the submitted registration application on the deal page', async () => {
    // Arrange
    mockGetDepositSent.mockResolvedValue({ sentOn: '2026-11-03', amountPence: null });
    mockGetRegistrationStatus.mockResolvedValue({
      completedAt: 1, awaitingApplication: false, submittedOn: '2026-11-13', applicationReference: 'TEST/123',
    });

    // Act
    render(<ConveyancerRecordRows transactionId="tx-1" />);

    // Assert
    expect(await screen.findByText("Deposit sent by the buyer's conveyancer on 3 November 2026")).toBeInTheDocument();
    expect(screen.getByText('Registration application submitted to HM Land Registry on 13 November 2026, ref TEST/123')).toBeInTheDocument();
    expect(mockGetDepositSent).toHaveBeenCalledWith('tx-1');
  });

  it('should show no registration row before completion', async () => {
    // Arrange
    mockGetDepositSent.mockResolvedValue(null);
    mockGetRegistrationStatus.mockResolvedValue({
      completedAt: null, awaitingApplication: false, submittedOn: null, applicationReference: null,
    });

    // Act
    render(<ConveyancerRecordRows transactionId="tx-1" />);

    // Assert
    expect(await screen.findByText('Not recorded yet')).toBeInTheDocument();
    expect(screen.queryByText('Registration application')).not.toBeInTheDocument();
  });

  it('should render nothing when both reads fail', async () => {
    // Arrange
    mockGetDepositSent.mockRejectedValue(new Error('unavailable'));
    mockGetRegistrationStatus.mockRejectedValue(new Error('unavailable'));

    // Act
    const { container } = render(<ConveyancerRecordRows transactionId="tx-1" />);
    await waitFor(() => expect(mockGetRegistrationStatus).toHaveBeenCalled());
    await Promise.resolve();

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('should not read anything without a transaction id', () => {
    const { container } = render(<ConveyancerRecordRows transactionId={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(mockGetDepositSent).not.toHaveBeenCalled();
  });
});
