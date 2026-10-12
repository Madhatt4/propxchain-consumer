// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchAgeLine } from '../SearchAgeLine';

describe('<SearchAgeLine>', () => {
  it('stays silent while searches are fresh', () => {
    const { container } = render(<SearchAgeLine transactionId="tx" ageOverride={{ state: 'ok', ageDays: 20, daysLeft: 163, orderedAt: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('warns at four months', () => {
    render(<SearchAgeLine transactionId="tx" ageOverride={{ state: 'ageing', ageDays: 125, daysLeft: 58, orderedAt: 0 }} />);
    expect(screen.getByTestId('search-age-line')).toHaveTextContent(/125 days old/);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('alerts once expired', () => {
    render(<SearchAgeLine transactionId="tx" ageOverride={{ state: 'expired', ageDays: 190, daysLeft: 0, orderedAt: 0 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/past the six months/);
  });
});
