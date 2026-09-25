// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TicketQueue from '../TicketQueue';
import type { AdminTicketSummary } from '../../../../services/supportAdmin.service';
import type { TicketStatus } from '../../../../services/supportTicket.service';

function ticket(over: Partial<AdminTicketSummary> & { id: string }): AdminTicketSummary {
  return {
    user_id: 'user-1',
    email: 'buyer@example.com',
    name: 'Test Buyer',
    subject: 'Subject',
    body: 'Body',
    category: 'forms',
    urgency: 0,
    blocks_transaction: false,
    transaction_id: null,
    page_path: null,
    stage: null,
    status: 'open',
    triage: null,
    source: 'form',
    created_at: '2026-09-19T09:00:00Z',
    updated_at: '2026-09-19T09:00:00Z',
    last_activity_at: '2026-09-19T09:00:00Z',
    message_count: 0,
    ...over,
  };
}

interface RenderOptions {
  tickets?: AdminTicketSummary[];
  filters?: TicketStatus[];
  selectedId?: string | null;
  isLoading?: boolean;
}

function renderQueue(options: RenderOptions = {}) {
  const onToggleFilter = vi.fn();
  const onShowAll = vi.fn();
  const onSelect = vi.fn();
  render(
    <MemoryRouter>
      <TicketQueue
        tickets={options.tickets ?? []}
        selectedId={options.selectedId ?? null}
        filters={options.filters ?? ['open', 'awaiting_user']}
        isLoading={options.isLoading ?? false}
        onToggleFilter={onToggleFilter}
        onShowAll={onShowAll}
        onSelect={onSelect}
      />
    </MemoryRouter>,
  );
  return { onToggleFilter, onShowAll, onSelect };
}

describe('TicketQueue', () => {
  it('should show a chip per status plus All, with the default two pressed', () => {
    renderQueue();

    const group = screen.getByRole('group', { name: /filter the queue/i });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Open',
      'Awaiting user',
      'Answered',
      'Closed',
      'All',
    ]);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Awaiting user' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Closed' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('should press the All chip only when every status is selected', () => {
    renderQueue({ filters: ['open', 'awaiting_user', 'answered', 'closed'] });

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should report which chip was clicked rather than filtering itself', () => {
    const { onToggleFilter, onShowAll } = renderQueue();

    fireEvent.click(screen.getByRole('button', { name: 'Closed' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(onToggleFilter).toHaveBeenCalledWith('closed');
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it('should show the Blocking badge only on a ticket that blocks the transaction', () => {
    renderQueue({
      tickets: [
        ticket({ id: 'a', subject: 'Cannot pay', blocks_transaction: true }),
        ticket({ id: 'b', subject: 'Question about EPC', blocks_transaction: false }),
      ],
    });

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('Blocking')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Blocking')).not.toBeInTheDocument();
  });

  it('should label urgency for a screen reader rather than leaving it as dots', () => {
    renderQueue({ tickets: [ticket({ id: 'a', urgency: 2 })] });

    expect(screen.getByLabelText('Urgency 2 of 3')).toBeInTheDocument();
  });

  it('should show the customer email, the category and the reply count on a row', () => {
    renderQueue({ tickets: [ticket({ id: 'a', category: 'id_aml', email: 'seller@example.com', message_count: 3 })] });

    expect(screen.getByText(/ID & AML · seller@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/3 replies/)).toBeInTheDocument();
  });

  it('should link a row to its transaction, outside the row button so it is reachable', () => {
    renderQueue({ tickets: [ticket({ id: 'a', transaction_id: 'TX-9' })] });

    const link = screen.getByRole('link', { name: 'Transaction TX-9' });
    expect(link).toHaveAttribute('href', '/transaction/TX-9/flow');
    expect(link.closest('button')).toBeNull();
  });

  it('should show no transaction link on a ticket raised outside a deal', () => {
    renderQueue({ tickets: [ticket({ id: 'a', transaction_id: null })] });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should hand the selected id back when a row is clicked', () => {
    const { onSelect } = renderQueue({ tickets: [ticket({ id: 'ticket-9', subject: 'Cannot pay' })] });

    fireEvent.click(screen.getByRole('button', { name: /Cannot pay/ }));

    expect(onSelect).toHaveBeenCalledWith('ticket-9');
  });

  it('should mark the open ticket as the current row', () => {
    renderQueue({
      tickets: [ticket({ id: 'a', subject: 'First' }), ticket({ id: 'b', subject: 'Second' })],
      selectedId: 'b',
    });

    expect(screen.getByRole('button', { name: /Second/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /First/ })).not.toHaveAttribute('aria-current');
  });

  it('should say the filter is empty rather than showing a blank pane', () => {
    renderQueue({ tickets: [] });

    expect(screen.getByText(/nothing in this queue/i)).toBeInTheDocument();
  });

  it('should say it is loading instead of claiming the queue is empty', () => {
    renderQueue({ tickets: [], isLoading: true });

    expect(screen.getByText(/loading the queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing in this queue/i)).not.toBeInTheDocument();
  });
});
