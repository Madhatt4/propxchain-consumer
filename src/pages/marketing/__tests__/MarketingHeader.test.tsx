// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ThemeProvider } from '@/contexts/ThemeContext';

import MarketingHeader from '../MarketingHeader';

describe('MarketingHeader', () => {
  it('should link every marketing page to the free property check', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <MarketingHeader />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Free property check' })).toHaveAttribute('href', '/property-check');
  });
});
