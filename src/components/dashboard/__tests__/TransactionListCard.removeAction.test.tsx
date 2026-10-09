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

describe('TransactionListCard remove action', () => {
  it('should label the item Delete when the viewer may delete', () => {
    render(<TransactionListCard {...baseProps} removeAction="delete" />);
    fireEvent.click(screen.getByLabelText('More actions'));
    expect(screen.getByRole('menuitem', { name: /delete transaction/i })).toBeInTheDocument();
  });

  it('should label the item Leave when the viewer may leave', () => {
    render(<TransactionListCard {...baseProps} role="buyer" removeAction="leave" />);
    fireEvent.click(screen.getByLabelText('More actions'));
    expect(screen.getByRole('menuitem', { name: /leave transaction/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete transaction/i })).not.toBeInTheDocument();
  });

  it('should offer neither when the canister would refuse both', () => {
    render(<TransactionListCard {...baseProps} removeAction="none" />);
    fireEvent.click(screen.getByLabelText('More actions'));
    expect(screen.queryByRole('menuitem', { name: /delete transaction/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /leave transaction/i })).not.toBeInTheDocument();
  });
});
