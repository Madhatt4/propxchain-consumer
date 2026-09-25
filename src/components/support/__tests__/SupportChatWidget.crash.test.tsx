// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The widget is mounted as a SIBLING of the routes' error boundary in
 * `App.tsx`, so without one of its own a render throw in the help chat would
 * take the dashboard down with it. This mirrors that composition and forces
 * the throw.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector({ isAuthenticated: true }),
}));

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

// The one thing that has to break for this test to mean anything.
vi.mock('../useSupportChat', () => ({
  useSupportChat: () => {
    throw new Error('chat exploded');
  },
}));

import { ErrorBoundary } from '../../common/ErrorBoundary';
import SupportChatWidget from '../SupportChatWidget';

/** The App.tsx composition: the widget in its own boundary, beside the routes. */
function renderApp(): void {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ErrorBoundary fallback={<></>}>
        <SupportChatWidget />
      </ErrorBoundary>
      <ErrorBoundary>
        <main>Dashboard content</main>
      </ErrorBoundary>
    </MemoryRouter>,
  );
}

describe('SupportChatWidget crash isolation', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React prints the caught error; the boundary handling it is the point.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('should leave the page standing when the chat throws while rendering', () => {
    renderApp();

    expect(screen.getByText('Dashboard content')).toBeTruthy();
  });

  it('should take the help button away rather than show a full-page error', () => {
    renderApp();

    expect(screen.queryByRole('button', { name: 'Open help chat' })).toBeNull();
    // An empty fragment fallback, not null: ErrorBoundary treats a falsy
    // fallback as "no fallback" and renders this instead.
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.queryByRole('button', { name: /Go Home/ })).toBeNull();
  });
});
