// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const mockMarkNeedsOnboarding = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/onboardingStatus', () => ({
  markUserNeedsOnboarding: () => mockMarkNeedsOnboarding(),
}));

const mockRegisterUser = vi.fn().mockResolvedValue({ success: true });
vi.mock('../../../services/icp.service', () => ({
  icpService: {
    initAuth: vi.fn().mockResolvedValue(true),
    getMyProfile: vi.fn().mockResolvedValue({
      name: 'Sam Seller',
      email: 'seller@example.com',
      mobile: '07700 900000',
      userType: 'seller',
    }),
    registerUser: (arg: unknown) => mockRegisterUser(arg),
    initialize: vi.fn(),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      principalId: 'aaaaa-bbbbb',
      isAuthenticated: true,
      supabaseUser: { email: 'seller@example.com', user_metadata: { role: 'seller' } },
      fetchProfile: vi.fn(),
    }),
  },
}));

import ProfileSetup from '../ProfileSetup';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ProfileSetup onboarding flag', () => {
  it('should write the needs-onboarding flag to the user, not localStorage, when a seller finishes setup', async () => {
    const { container } = render(<MemoryRouter><ProfileSetup /></MemoryRouter>);
    await waitFor(() => {
      expect((screen.getByLabelText(/email address/i) as HTMLInputElement).value).toBe('seller@example.com');
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding/role'));
    expect(mockMarkNeedsOnboarding).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('needsOnboarding')).toBeNull();
  });
});
