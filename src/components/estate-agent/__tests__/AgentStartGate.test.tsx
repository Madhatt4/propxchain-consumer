// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AgentStartGate from '../AgentStartGate';

function renderGate(): void {
  render(
    <MemoryRouter>
      <AgentStartGate />
    </MemoryRouter>,
  );
}

describe('<AgentStartGate>', () => {
  it('should send "yes, acting for a seller" to the listing import', () => {
    renderGate();

    expect(screen.getByRole('link', { name: /yes, i.m acting for a seller/i })).toHaveAttribute(
      'href',
      '/estate-agent/listings/new',
    );
  });

  it('should send "no, I have a code" to the join page', () => {
    renderGate();

    expect(screen.getByRole('link', { name: /no, i have a transaction code/i })).toHaveAttribute('href', '/join');
  });

  it('should always offer the way back to the dashboard', () => {
    renderGate();

    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('should write the price into the copy', () => {
    renderGate();

    expect(screen.getByText('Free, no platform fee')).toBeInTheDocument();
  });
});
