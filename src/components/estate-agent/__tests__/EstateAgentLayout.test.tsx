// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/components/navigation/AppTopBar', () => ({
  default: ({
    title,
    menuItems,
    backTo,
    backLabel,
  }: {
    title: string;
    menuItems?: Array<{ label: string; to: string }>;
    backTo?: string;
    backLabel?: string;
  }) => (
    <nav data-testid="topbar">
      {title}
      {backTo && <a href={backTo}>{backLabel}</a>}
      {menuItems?.map((m) => <a key={m.to} href={m.to}>{m.label}</a>)}
    </nav>
  ),
}));
vi.mock('@/components/common/BlueprintBackground', () => ({ default: () => null }));
import EstateAgentLayout from '../EstateAgentLayout';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/estate-agent" element={<EstateAgentLayout />}>
          <Route path="listings" element={<div data-testid="child" />} />
          <Route path="listings/new" element={<div data-testid="child" />} />
          <Route path="listings/:id" element={<div data-testid="child" />} />
          <Route path="pipeline" element={<div data-testid="child" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('<EstateAgentLayout>', () => {
  it('renders the agent portal top bar with Listings and Pipeline links around the outlet', () => {
    renderAt('/estate-agent/listings');
    const topbar = screen.getByTestId('topbar');
    expect(topbar).toHaveTextContent('Agent portal');
    expect(within(topbar).getByRole('link', { name: 'Listings' })).toHaveAttribute('href', '/estate-agent/listings');
    expect(within(topbar).getByRole('link', { name: 'Pipeline' })).toHaveAttribute('href', '/estate-agent/pipeline');
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should show a back-to-listings control on a listing detail page', () => {
    renderAt('/estate-agent/listings/row-1');

    expect(screen.getByRole('link', { name: 'Back to listings' })).toHaveAttribute('href', '/estate-agent/listings');
  });

  it('should show a back-to-listings control on the create page', () => {
    renderAt('/estate-agent/listings/new');

    expect(screen.getByRole('link', { name: 'Back to listings' })).toHaveAttribute('href', '/estate-agent/listings');
  });

  it('should not show a back control on the top-level listings and pipeline pages', () => {
    renderAt('/estate-agent/pipeline');

    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument();
  });

  it('should render a visible Listings / Pipeline tab strip marking the current section', () => {
    renderAt('/estate-agent/pipeline');

    const tabs = screen.getByRole('navigation', { name: 'Agent portal sections' });
    expect(within(tabs).getByRole('link', { name: 'Listings' })).toHaveAttribute('href', '/estate-agent/listings');
    expect(within(tabs).getByRole('link', { name: 'Pipeline' })).toHaveAttribute('aria-current', 'page');
  });
});
