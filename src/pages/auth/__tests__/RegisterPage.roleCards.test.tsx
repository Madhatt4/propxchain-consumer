// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../../components/auth/AuthShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../../components/auth/OAuthButtons', () => ({
  default: () => <div>OAuthButtons</div>,
}));

const mockAuthState = {
  registerWithEmail: vi.fn(),
  isLoading: false,
  error: null as string | null,
  clearError: vi.fn(),
  isAuthenticated: false,
};
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: Object.assign(() => mockAuthState, { getState: () => mockAuthState }),
  useIdentityError: () => null,
}));

import RegisterPage from '../RegisterPage';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/estate-agent" element={<div data-testid="agent-door" />} />
        <Route path="/register/conveyancer" element={<div data-testid="conveyancer-door" />} />
        <Route path="/register/developer" element={<div data-testid="developer-door" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('RegisterPage - role cards', () => {
  it('should offer all five roles before any account form', () => {
    renderAt('/register');

    for (const title of ["I'm selling", "I'm buying", "I'm an estate agent", "I'm a conveyancer", "I'm a developer"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.queryByText('Register with email')).not.toBeInTheDocument();
  });

  it('should write the price into every card', () => {
    renderAt('/register');

    expect(screen.getAllByText('Free, no platform fee')).toHaveLength(5);
  });

  it.each([
    ["I'm an estate agent", 'agent-door'],
    ["I'm a conveyancer", 'conveyancer-door'],
    ["I'm a developer", 'developer-door'],
  ])('should send "%s" to its own registration door', async (title, testId) => {
    renderAt('/register');

    fireEvent.click(screen.getByText(title));

    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('should carry a seller on to the account form with the role fixed', async () => {
    renderAt('/register');

    fireEvent.click(screen.getByText("I'm selling"));
    fireEvent.click(await screen.findByText('Register with email'));

    expect(await screen.findByTestId('role-locked')).toHaveTextContent('Registering as a property seller');
    expect(screen.queryByLabelText('I am aâ€¦')).not.toBeInTheDocument();
  });

  it('should let them go back and change the role', async () => {
    renderAt('/register');

    fireEvent.click(screen.getByText("I'm buying"));
    fireEvent.click(await screen.findByText('Register with email'));
    fireEvent.click(await screen.findByText('Change'));

    expect(await screen.findByText("I'm an estate agent")).toBeInTheDocument();
  });

  it('should skip the cards for an invite link', () => {
    renderAt('/register?invite=TX-1234-ABCD&role=buyer');

    expect(screen.queryByText("I'm an estate agent")).not.toBeInTheDocument();
    expect(screen.getByText('Register with email')).toBeInTheDocument();
  });

  it('should skip the cards when the link already names a role', () => {
    renderAt('/register?role=solicitor');

    expect(screen.queryByText("I'm an estate agent")).not.toBeInTheDocument();
    expect(screen.getByText('Register with email')).toBeInTheDocument();
  });
});
