// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionListCard from '../TransactionListCard';

const baseProps = {
  id: 'tx-1234567890abcdef',
  address: '1 High Street',
  amount: 250000,
  status: 'active',
  statusLabel: 'Active',
  progress: 20,
  role: 'seller' as const,
  createdDate: '01/10/2026',
  modeLabel: 'Standard',
  typeLabel: 'Sale',
  listing: null,
  onOpen: vi.fn(),
  onEdit: vi.fn(),
  onRemove: vi.fn(),
};

describe('TransactionListCard "View as conveyancer"', () => {
  it('should not offer the item unless a handler is given', () => {
    render(<TransactionListCard {...baseProps} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    expect(screen.queryByRole('menuitem', { name: /view as conveyancer/i })).not.toBeInTheDocument();
  });

  it('should call the handler without opening the card', () => {
    const onViewAsConveyancer = vi.fn();
    const onOpen = vi.fn();
    render(<TransactionListCard {...baseProps} onOpen={onOpen} onViewAsConveyancer={onViewAsConveyancer} />);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /view as conveyancer/i }));
    expect(onViewAsConveyancer).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
