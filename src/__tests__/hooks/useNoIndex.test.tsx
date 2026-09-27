// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import { useAuthStore } from '../../stores/authStore';

const robotsMeta = (): Element | null => document.head.querySelector('meta[name="robots"]');

describe('noindex on protected routes', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ isAuthenticated: false, isInitialized: false, isLoading: false });
  });

  it('should add robots noindex while a protected page is mounted', () => {
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, isLoading: false });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <p>dashboard</p>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(robotsMeta()?.getAttribute('content')).toBe('noindex');
  });

  it('should add noindex while auth is still initialising', () => {
    useAuthStore.setState({ isAuthenticated: false, isInitialized: false, isLoading: true });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <p>dashboard</p>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(robotsMeta()?.getAttribute('content')).toBe('noindex');
  });

  it('should remove the tag when the protected page unmounts', () => {
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, isLoading: false });
    const { unmount } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <p>dashboard</p>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    unmount();

    expect(robotsMeta()).toBeNull();
  });
});
