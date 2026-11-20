// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
const mockGetInviteCode = vi.fn();
vi.mock('../../../services/icp.service', () => ({
  icpService: { transactionManager: { getInviteCode: (...a: unknown[]) => mockGetInviteCode(...a) } },
}));
const mockInviteState = vi.fn(() => 'share');
vi.mock('@/hooks/useBuyerInviteState', () => ({ useBuyerInviteState: () => mockInviteState() }));

import { InviteStakeholderModal } from '../InviteStakeholderModal';

function renderModal(inviteCode?: string): void {
  render(
    <MemoryRouter>
      <InviteStakeholderModal
        isOpen
        onClose={vi.fn()}
        transactionId="tx_9"
        transactionAddress="1 Test Street"
        inviteCode={inviteCode}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInviteState.mockReturnValue('share');
  mockGetInviteCode.mockResolvedValue({ ok: 'TX-AB12-CD34' });
});

describe('InviteStakeholderModal', () => {
  it('should offer the code to the buyer only, with no role picker', () => {
    renderModal('TX-AB12-CD34');
    expect(screen.getByRole('heading', { name: 'Invite your buyer' })).toBeInTheDocument();
    expect(screen.getByText('TX-AB12-CD34')).toBeInTheDocument();
    expect(screen.getByTestId('buyer-only-note')).toHaveTextContent(/for your buyer only/);
    expect(screen.getByTestId('buyer-only-note')).toHaveTextContent(/accept their estimate/);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/Add people to the transaction/)).toBeNull();
  });

  it('should point estate agents to the agent invite on the deal page', () => {
    renderModal('TX-AB12-CD34');
    expect(screen.getByRole('link', { name: 'deal page' })).toHaveAttribute('href', '/transaction/tx_9/flow');
  });

  it('should show a short line and no code once the buyer has joined', () => {
    mockInviteState.mockReturnValue('buyerJoined');
    renderModal('TX-AB12-CD34');
    expect(screen.getByTestId('buyer-invite-unavailable')).toHaveTextContent(/already joined/);
    expect(screen.queryByText('TX-AB12-CD34')).toBeNull();
    expect(screen.queryByRole('button', { name: /Email Invite/ })).toBeNull();
  });

  it('should not fetch or show the code for the buyer', () => {
    mockInviteState.mockReturnValue('notSellerSide');
    renderModal();
    expect(screen.getByTestId('buyer-invite-unavailable')).toHaveTextContent(/for the seller side/);
    expect(mockGetInviteCode).not.toHaveBeenCalled();
  });
});
