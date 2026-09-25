// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { MarketingNav } from '../MarketingNav';

/**
 * "Log in" opens the card over the landing page instead of routing to /login.
 *
 * These stay <Link>s rather than buttons on purpose: the href is what makes
 * middle-click, "open in new tab" and a copied link land somewhere that works.
 * Both breakpoints have their own copy of the control, and the mobile one was
 * the easy one to miss.
 */
const noop = (): void => {};

function renderNav(): void {
  render(
    <MemoryRouter>
      <MarketingNav isDark={false} onToggleTheme={noop} onScrollTo={noop} />
    </MemoryRouter>,
  );
}

describe('landing nav sign-in', () => {
  it('should point the desktop Log in link at the sign-in card', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/?signin=1');
  });

  it('should point the mobile menu Log in link at the sign-in card', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const links = screen.getAllByRole('link', { name: 'Log in' });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/?signin=1'));
  });
});
