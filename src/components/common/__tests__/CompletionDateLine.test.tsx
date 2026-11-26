// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CompletionDateLine from '../CompletionDateLine';

describe('CompletionDateLine', () => {
  it('should show the agreed date and an Add to calendar button when a date is set', () => {
    render(<CompletionDateLine date="2026-12-15" propertyAddress="1 High St" />);

    expect(screen.getByText('15 December 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to calendar' })).toBeInTheDocument();
  });

  it('should put the property address in the calendar event title', () => {
    render(<CompletionDateLine date="2026-12-15" propertyAddress="1 High St" />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }));

    const google = screen.getByRole('link', { name: 'Google Calendar' }).getAttribute('href') ?? '';
    expect(new URL(google).searchParams.get('text')).toBe('Completion: 1 High St');
  });

  it('should accept a date with a time part', () => {
    render(<CompletionDateLine date="2026-12-15T00:00:00Z" />);

    expect(screen.getByText('15 December 2026')).toBeInTheDocument();
  });

  it.each([undefined, null, '', 'not a date', '2026-02-30'])('should render nothing for %s', (date) => {
    const { container } = render(<CompletionDateLine date={date} />);

    expect(container).toBeEmptyDOMElement();
  });
});
