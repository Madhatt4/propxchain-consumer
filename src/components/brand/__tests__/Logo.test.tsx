// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Logo } from '../Logo';

describe('Logo', () => {
  it('should show the registered trade mark symbol beside the wordmark', () => {
    render(
      <MemoryRouter>
        <Logo />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('registered-mark')).toHaveTextContent('®');
  });

  it('should keep the accessible name as the plain brand name', () => {
    render(<Logo to={null} />);

    expect(screen.getByRole('img', { name: 'PropXchain' })).toBeInTheDocument();
  });

  it('should hide the symbol overlay from screen readers', () => {
    render(<Logo to={null} />);

    expect(screen.getByTestId('registered-mark')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render the type-set wordmark rather than the old lockup image', () => {
    const { container } = render(<Logo to={null} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'PropXchain' })).toHaveTextContent(/^PropXchain/);
  });
});
