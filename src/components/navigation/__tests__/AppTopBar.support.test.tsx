// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Help & Support must be reachable from every page that uses the top bar: the
 * premium dashboard and the transaction pages do not carry the old sidebar,
 * which used to be the only way to /dashboard/support.
 */
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

describe('AppTopBar help and support entry', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    render(
      <MemoryRouter>
        <AppTopBar title="My transactions" />
      </MemoryRouter>,
    );
  });

  it('should offer a Help & Support icon button that routes to the support page', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Help & Support' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/support');
  });

  it('should list Help & Support in the avatar menu for small screens', () => {
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help & Support' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/support');
  });
});
