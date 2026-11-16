// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SraAttribution } from '../SraAttribution';
import { SRA_ATTRIBUTION_URL, showsSraFirm } from '../../../services/regulator';

describe('SraAttribution', () => {
  it('should credit the SRA with a link to its attribution statement', () => {
    render(<SraAttribution />);
    const link = screen.getByRole('link', { name: 'Solicitors Regulation Authority' });
    expect(link).toHaveAttribute('href', SRA_ATTRIBUTION_URL);
    expect(screen.getByText(/includes data supplied by the/)).toBeInTheDocument();
  });

  it('should be needed only when an SRA firm is on screen', () => {
    expect(showsSraFirm([{ regulator: 'CLC' }, { regulator: undefined }])).toBe(false);
    expect(showsSraFirm([{ regulator: 'CLC' }, { regulator: 'SRA' }])).toBe(true);
    expect(showsSraFirm([])).toBe(false);
  });
});
