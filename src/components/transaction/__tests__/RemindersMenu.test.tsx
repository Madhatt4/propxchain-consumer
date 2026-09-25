import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { RemindersMenu } from '../RemindersMenu';
import type { Reminder } from '../../../services/remindersService';

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    get transactionManager() {
      return { getTransaction: vi.fn() };
    },
    get ledgerManager() {
      return { getEventsByTransaction: vi.fn() };
    },
  },
}));

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    urgency: 'high',
    message: 'Something is overdue',
    suggestedAction: 'Do the thing.',
    triggeredAt: 1,
    source: 'test',
    ...overrides,
  };
}

/** The list lives in a popover now — open it before asserting on contents. */
function openMenu(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /reminders/i }));
  return screen.getByRole('region', { name: 'Transaction reminders' });
}

describe('RemindersMenu', () => {
  it('renders nothing when reminders is an empty array', () => {
    const { container } = render(
      <RemindersMenu transactionId="tx-1" remindersOverride={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders each reminder with its message + suggested action', () => {
    const reminders: Reminder[] = [
      makeReminder({
        id: 'a',
        urgency: 'critical',
        message: 'SDLT deadline looming',
        suggestedAction: 'File it now.',
      }),
      makeReminder({
        id: 'b',
        urgency: 'medium',
        message: 'TA6 not completed',
        suggestedAction: 'Fill out TA6.',
      }),
    ];
    render(<RemindersMenu transactionId="tx-1" remindersOverride={reminders} />);
    const panel = openMenu();
    expect(within(panel).getByText('SDLT deadline looming')).toBeInTheDocument();
    expect(within(panel).getByText('File it now.')).toBeInTheDocument();
    expect(within(panel).getByText('TA6 not completed')).toBeInTheDocument();
    expect(within(panel).getByText('Fill out TA6.')).toBeInTheDocument();
  });

  it('shows the count of items on the trigger', () => {
    const reminders = [makeReminder(), makeReminder({ id: 'r2' })];
    render(<RemindersMenu transactionId="tx-1" remindersOverride={reminders} />);
    expect(screen.getByRole('button', { name: /2 items/i })).toBeInTheDocument();
  });

  it('uses "item" (singular) when exactly one reminder', () => {
    render(
      <RemindersMenu
        transactionId="tx-1"
        remindersOverride={[makeReminder()]}
      />,
    );
    expect(screen.getByRole('button', { name: /1 item/i })).toBeInTheDocument();
  });

  it('shows Critical label for critical urgency', () => {
    render(
      <RemindersMenu
        transactionId="tx-1"
        remindersOverride={[makeReminder({ urgency: 'critical' })]}
      />,
    );
    const panel = openMenu();
    expect(within(panel).getByText('Critical')).toBeInTheDocument();
  });
});
