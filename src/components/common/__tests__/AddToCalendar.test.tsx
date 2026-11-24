// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AddToCalendar from '../AddToCalendar';

const EVENT = { title: 'Completion: 1 High St', date: '2026-12-15', details: 'Agreed date' };

describe('AddToCalendar', () => {
  it('should keep the menu closed until the button is pressed', () => {
    render(<AddToCalendar event={EVENT} />);

    expect(screen.getByRole('button', { name: 'Add to calendar' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
  });

  it('should show Google, Outlook and .ics options when opened', () => {
    render(<AddToCalendar event={EVENT} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }));

    expect(screen.getByRole('link', { name: 'Google Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Outlook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apple / other (.ics)' })).toBeInTheDocument();
  });

  it('should point the Google link at the all-day event', () => {
    render(<AddToCalendar event={EVENT} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }));

    const href = screen.getByRole('link', { name: 'Google Calendar' }).getAttribute('href') ?? '';
    const parsed = new URL(href);
    expect(parsed.hostname).toBe('calendar.google.com');
    expect(parsed.searchParams.get('text')).toBe('Completion: 1 High St');
    expect(parsed.searchParams.get('dates')).toBe('20261215/20261216');
  });

  it('should close the menu on Escape', () => {
    render(<AddToCalendar event={EVENT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
  });

  it('should render nothing for an invalid date', () => {
    const { container } = render(<AddToCalendar event={{ title: 'x', date: 'soon' }} />);

    expect(container).toBeEmptyDOMElement();
  });
});
