// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ toggleTheme: vi.fn(), isDark: false }),
}));

vi.mock('@/stores/authStore', () => {
  const state = { supabaseUser: null, userProfile: { name: 'Marc Hatton' }, principalId: 'aaaaa-aa', logout: vi.fn() };
  const useAuthStore = (selector: (s: typeof state) => unknown): unknown => selector(state);
  useAuthStore.getState = (): typeof state => state;
  return { useAuthStore };
});

import { AppTopBar } from '../AppTopBar';

function openMenu(isAdmin: boolean): void {
  render(
    <MemoryRouter>
      <AppTopBar title="My transactions" isAdmin={isAdmin} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
}

describe('AppTopBar admin menu', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('should list every admin portal in order and route the estate agent one to /estate-agent', () => {
    openMenu(true);

    const labels = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(labels.slice(-5)).toEqual(['Admin dashboard', 'Builder portal', 'Conveyancer portal', 'Estate agent portal', 'Log out']);

    fireEvent.click(screen.getByRole('menuitem', { name: /estate agent portal/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/estate-agent');
  });

  it('should hide the admin portals from non-admins', () => {
    openMenu(false);

    expect(screen.queryByRole('menuitem', { name: /estate agent portal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /admin dashboard/i })).not.toBeInTheDocument();
  });
});
