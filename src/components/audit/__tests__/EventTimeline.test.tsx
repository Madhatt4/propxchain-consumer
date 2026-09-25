import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventTimeline from '../EventTimeline';
import type { AuditEvent } from '../../../services/transactionAudit';

// Mock useThemeClasses to avoid ThemeContext dependency
vi.mock('../../../hooks/useThemeClasses', () => ({
  useThemeClasses: () => ({
    textPrimary: 'text-primary',
    textSecondary: 'text-secondary',
    textTertiary: 'text-tertiary',
    cardPrimary: 'card-primary',
    cardSecondary: 'card-secondary',
  }),
}));

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    eventId: 1,
    transactionId: 'tx-001',
    eventType: 'transaction_created',
    timestamp: Date.now() * 1_000_000,
    caller: 'abc-principal',
    details: 'Transaction created',
    metadata: null,
    ...overrides,
  };
}

describe('EventTimeline', () => {
  it('should show "No events recorded" when events array is empty', () => {
    render(<EventTimeline events={[]} />);

    expect(screen.getByText('No events recorded yet')).toBeInTheDocument();
  });

  it('should render milestones with correct grouping', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'transaction_created', details: 'Created' }),
      makeEvent({ eventId: 2, eventType: 'document_uploaded', details: 'Doc uploaded' }),
      makeEvent({ eventId: 3, eventType: 'document_uploaded', details: 'Second doc' }),
    ];

    render(<EventTimeline events={events} />);

    // Both milestone names should be visible
    expect(screen.getByText('Property Listed')).toBeInTheDocument();
    expect(screen.getByText('Documents Uploaded')).toBeInTheDocument();

    // Event counts in parentheses
    expect(screen.getByText('(1 event)')).toBeInTheDocument();
    expect(screen.getByText('(2 events)')).toBeInTheDocument();
  });

  it('should have collapsible milestone sections', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'transaction_created', details: 'Transaction was created' }),
    ];

    render(<EventTimeline events={events} />);

    // Event details should not be visible initially (collapsed)
    expect(screen.queryByText('Transaction was created')).not.toBeInTheDocument();

    // Click to expand
    const milestoneButton = screen.getByText('Property Listed').closest('button');
    expect(milestoneButton).toBeTruthy();
    fireEvent.click(milestoneButton!);

    // Now event details should be visible
    expect(screen.getByText('Transaction was created')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(milestoneButton!);
    expect(screen.queryByText('Transaction was created')).not.toBeInTheDocument();
  });

  it('should render metadata when present', () => {
    const events: AuditEvent[] = [
      makeEvent({
        eventId: 1,
        eventType: 'transaction_created',
        details: 'Created',
        metadata: '0xdeadbeef',
      }),
    ];

    render(<EventTimeline events={events} />);

    // Expand the milestone
    const milestoneButton = screen.getByText('Property Listed').closest('button');
    fireEvent.click(milestoneButton!);

    expect(screen.getByText('0xdeadbeef')).toBeInTheDocument();
  });
});
