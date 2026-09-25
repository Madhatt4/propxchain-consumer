// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockList = vi.fn();
const mockAdd = vi.fn();
const mockDone = vi.fn();
const mockAnchor = vi.fn();
vi.mock('@/services/chaseLog.service', () => ({
  listChaseLog: (...args: unknown[]) => mockList(...args),
  addChaseEntry: (...args: unknown[]) => mockAdd(...args),
  markChaseDone: (...args: unknown[]) => mockDone(...args),
  anchorChaseEntry: (...args: unknown[]) => mockAnchor(...args),
}));

import ChaseLogPanel from '../ChaseLogPanel';

const entry = (over: Record<string, unknown>) => ({
  id: 'n1', orgId: 'org', transactionId: 'tx_1', listingId: 'l1', authorUserId: 'u1', kind: 'call', body: 'Rang the seller',
  dueAt: null, doneAt: null, createdAt: '2026-09-06T10:00:00.000Z', ledgerHash: 'a'.repeat(64), ledgerPending: false, ...over,
});

function renderPanel(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ChaseLogPanel transactionId="tx_1" listingId="l1" organisationId="org" />
    </QueryClientProvider>,
  );
}

describe('ChaseLogPanel', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockAdd.mockReset();
    mockDone.mockReset();
    mockAnchor.mockReset();
  });

  it('lists entries newest first with their anchor state, and marks an open next action done', async () => {
    mockList.mockResolvedValue([
      entry({ id: 'n2', kind: 'next_action', body: 'Chase the searches', dueAt: '2026-09-09T09:00:00.000Z', ledgerHash: null, ledgerPending: true }),
      entry({}),
    ]);
    mockDone.mockResolvedValue(undefined);
    renderPanel();
    const rows = await screen.findAllByTestId('chase-entry');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Next action');
    expect(rows[0]).toHaveTextContent('Chase the searches');
    expect(rows[0].querySelector('[data-testid="chase-anchor"]')).toHaveAttribute('data-anchored', 'false');
    expect(rows[1].querySelector('[data-testid="chase-anchor"]')).toHaveAttribute('data-anchored', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    await waitFor(() => expect(mockDone).toHaveBeenCalledWith('n2'));
  });

  it('adds a call with the agency, deal and listing, and clears the box', async () => {
    mockList.mockResolvedValue([]);
    mockAdd.mockResolvedValue(entry({ id: 'n3', body: 'Left a message' }));
    renderPanel();
    expect(await screen.findByTestId('chase-empty')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('What happened, or what to do'), { target: { value: 'Left a message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the log' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith({ orgId: 'org', transactionId: 'tx_1', listingId: 'l1', kind: 'call', body: 'Left a message', dueAt: null }));
    await waitFor(() => expect(screen.getByLabelText('What happened, or what to do')).toHaveValue(''));
  });

  it('a next action needs a due date, and sends one at nine in the morning when given', async () => {
    mockList.mockResolvedValue([]);
    mockAdd.mockResolvedValue(entry({ id: 'n4', kind: 'next_action' }));
    renderPanel();
    await screen.findByTestId('chase-empty');
    fireEvent.change(screen.getByLabelText('Entry'), { target: { value: 'next_action' } });
    fireEvent.change(screen.getByLabelText('What happened, or what to do'), { target: { value: 'Chase the pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the log' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('needs a due date');
    expect(mockAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Due'), { target: { value: '2026-09-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the log' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalled());
    const sent = mockAdd.mock.calls[0][0] as { kind: string; dueAt: string };
    expect(sent.kind).toBe('next_action');
    expect(sent.dueAt).toBe(new Date('2026-09-10T09:00:00').toISOString());
  });

  it('a failed read is an error, never an empty log', async () => {
    mockList.mockRejectedValue(new Error('permission denied'));
    renderPanel();
    expect(await screen.findByTestId('chase-error')).toHaveTextContent('Could not load the log');
    expect(screen.queryByTestId('chase-empty')).toBeNull();
  });

  it('an entry not yet on the trail can be re-anchored from its marker', async () => {
    mockList.mockResolvedValue([entry({ id: 'n5', ledgerHash: null, ledgerPending: true })]);
    mockAnchor.mockResolvedValue({ ledgerPending: false, ledgerHash: 'c'.repeat(64) });
    renderPanel();
    const marker = await screen.findByTestId('chase-anchor');
    expect(marker).toHaveAttribute('data-anchored', 'false');
    fireEvent.click(marker);
    await waitFor(() => expect(mockAnchor).toHaveBeenCalledWith('n5'));
  });
});
