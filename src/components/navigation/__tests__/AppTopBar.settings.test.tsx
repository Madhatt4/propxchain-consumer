// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Settings must be reachable from the avatar menu. Before this, nothing linked
 * to /dashboard/settings, so the page could only be opened by typing the URL.
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

describe('AppTopBar settings entry', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('should list Settings in the avatar menu', () => {
    render(
      <MemoryRouter>
        <AppTopBar title="My transactions" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/settings');
  });
});
