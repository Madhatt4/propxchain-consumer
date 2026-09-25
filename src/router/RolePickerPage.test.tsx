// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { OrganisationMembership } from './decideRoute';

const mockAuthState = {
  supabaseUser: { id: 'user-1' } as { id: string } | null,
};

vi.mock('../stores/authStore', () => ({
  useAuthStore: <T,>(selector: (s: typeof mockAuthState) => T): T =>
    selector(mockAuthState),
}));

let mockMemberships: OrganisationMembership[] = [];
vi.mock('./useMembershipsQuery', () => ({
  useMembershipsQuery: () => ({
    data: mockMemberships,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import RolePickerPage from './RolePickerPage';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/role-picker']}>
      <Routes>
        <Route path="/role-picker" element={<RolePickerPage />} />
        <Route path="/post-login" element={<div data-testid="at-post-login" />} />
      </Routes>
    </MemoryRouter>,
  );

describe('<RolePickerPage>', () => {
  beforeEach(() => {
    // Clear cookies between tests
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=; path=/; max-age=0`;
    });
    mockMemberships = [];
  });

  it('renders a button per membership with label and role', () => {
    mockMemberships = [
      { organisationId: 'org-a', organisationType: 'developer', role: 'admin' },
      {
        organisationId: 'org-b',
        organisationType: 'solicitor_firm',
        role: 'member',
      },
    ];
    renderPage();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('org-a');
    expect(buttons[0]).toHaveTextContent(/Developer/);
    expect(buttons[1]).toHaveTextContent('org-b');
    expect(buttons[1]).toHaveTextContent(/Solicitor firm/);
  });

  it('sets the lastUsedRole cookie and navigates to /post-login on click', () => {
    mockMemberships = [
      { organisationId: 'org-a', organisationType: 'developer', role: 'admin' },
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button'));
    expect(document.cookie).toContain('lastUsedRole=developer');
    expect(screen.getByTestId('at-post-login')).toBeInTheDocument();
  });
});
