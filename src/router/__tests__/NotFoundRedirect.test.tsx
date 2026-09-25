import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotFoundRedirect from '../NotFoundRedirect';

let storeState = { isAuthenticated: false, isInitialized: false };

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof storeState) => unknown): unknown => selector(storeState),
}));

function renderAt(path = '/some-stale-link'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>MARKETING HOME</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="*" element={<NotFoundRedirect />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotFoundRedirect', () => {
  beforeEach(() => {
    storeState = { isAuthenticated: false, isInitialized: false };
  });

  // THE REGRESSION. The auth store restores asynchronously, so on a hard
  // page-load isAuthenticated is false before it settles. Redirecting on that
  // first render sent a signed-in user to the public marketing home — looking
  // logged out. Any test that rendered with the store already settled would
  // have passed, which is why it survived.
  it('should redirect NOWHERE until the auth store has initialised', () => {
    storeState = { isAuthenticated: false, isInitialized: false };
    renderAt();

    expect(screen.queryByText('MARKETING HOME')).not.toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('should send a signed-in user to the dashboard once initialised', () => {
    storeState = { isAuthenticated: true, isInitialized: true };
    renderAt();

    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('should send a signed-out user to the marketing home once initialised', () => {
    storeState = { isAuthenticated: false, isInitialized: true };
    renderAt();

    expect(screen.getByText('MARKETING HOME')).toBeInTheDocument();
  });

  it('should not send a signed-in user to the marketing home, ever', () => {
    // Belt and braces on the actual user-visible symptom, stated as the
    // symptom rather than as the mechanism.
    storeState = { isAuthenticated: true, isInitialized: true };
    renderAt('/another-stale-link');

    expect(screen.queryByText('MARKETING HOME')).not.toBeInTheDocument();
  });
});
