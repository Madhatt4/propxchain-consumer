// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('../OAuthButtons', () => ({
  default: () => <div>OAuthButtons</div>,
}));

const mockAuthState = {
  loginWithEmail: vi.fn(),
  loginWithII: vi.fn(),
  isLoading: false,
  error: null as string | null,
  clearError: vi.fn(),
  isAuthenticated: false,
  isInitialized: true,
};
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: Object.assign(() => mockAuthState, { getState: () => mockAuthState }),
  useIdentityError: () => null,
}));
// Where a signed-in visitor lands is postLoginRoute's job and has its own
// tests — this file only cares that the dialog defers to it.
vi.mock('../../../pages/auth/postLoginRoute', () => ({
  getPostLoginRoute: () => '/dashboard',
}));

import SignInDialog from '../SignInDialog';

beforeEach(() => {
  mockAuthState.isAuthenticated = false;
});

/** Renders the URL the router is on, so a close can be asserted on. */
function LocationProbe(): JSX.Element {
  const { pathname, search } = useLocation();
  return <div data-testid="url">{`${pathname}${search}`}</div>;
}

function renderDialog(entries: string[], index = entries.length - 1): void {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <div>Landing page content</div>
      <SignInDialog />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const url = (): string => screen.getByTestId('url').textContent ?? '';

describe('SignInDialog', () => {
  it('should render nothing when the signin param is absent', () => {
    renderDialog(['/']);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should open on /?signin=1 with the method list', () => {
    renderDialog(['/?signin=1']);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with internet identity/i }),
    ).toBeInTheDocument();
  });

  it('should label the dialog with its heading', () => {
    renderDialog(['/?signin=1']);

    expect(screen.getByRole('dialog', { name: 'Sign in.' })).toBeInTheDocument();
  });

  it('should drop the param on Escape when the visitor arrived on the link directly', async () => {
    renderDialog(['/?signin=1']);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Dropped the param rather than navigating off a site they have no
    // history on — the landing page is still underneath.
    expect(url()).toBe('/');
    expect(screen.getByText('Landing page content')).toBeInTheDocument();
  });

  it('should preserve other query params when closing', async () => {
    renderDialog(['/?utm_source=x&signin=1']);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(url()).toBe('/?utm_source=x'));
  });

  it('should go back a history entry when the visitor opened it from the page', async () => {
    renderDialog(['/', '/?signin=1'], 1);

    fireEvent.click(screen.getByRole('button', { name: /close sign in/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Popped, so the card is not left sitting behind the Back button.
    expect(url()).toBe('/');
  });

  it('should send an already signed-in visitor on instead of asking them to sign in twice', async () => {
    mockAuthState.isAuthenticated = true;

    renderDialog(['/?signin=1']);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(url()).toBe('/dashboard'));
  });

  it('should step into the email form and back to the methods without closing', () => {
    renderDialog(['/?signin=1']);

    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /choose another method/i }));
    expect(screen.getByRole('button', { name: /continue with internet identity/i })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
