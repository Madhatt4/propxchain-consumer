// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser: (arg: unknown) => mockUpdateUser(arg) } },
}));
const mockWarn = vi.fn();
vi.mock('@/utils/logger', () => ({ logger: { warn: (...args: unknown[]) => mockWarn(...args), info: vi.fn(), error: vi.fn() } }));

import { useAuthStore } from '@/stores/authStore';
import { markUserNeedsOnboarding, markUserOnboarded } from '../onboardingStatus';

const updatedUser = { id: 'user-1', user_metadata: { propxchain_onboarded: true } };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ authMethod: 'supabase', supabaseUser: null });
  mockUpdateUser.mockResolvedValue({ data: { user: updatedUser }, error: null });
});

describe('onboardingStatus', () => {
  it('should write propxchain_needs_onboarding to the user metadata and not to localStorage', async () => {
    await markUserNeedsOnboarding();

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { propxchain_needs_onboarding: true } });
    expect(localStorage.getItem('needsOnboarding')).toBeNull();
  });

  it('should set propxchain_onboarded and clear propxchain_needs_onboarding on the user', async () => {
    await markUserOnboarded();

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { propxchain_onboarded: true, propxchain_needs_onboarding: false },
    });
    expect(localStorage.getItem('onboardingComplete')).toBeNull();
  });

  it('should refresh the cached supabaseUser in the auth store after a successful write', async () => {
    await markUserOnboarded();

    expect(useAuthStore.getState().supabaseUser).toEqual(updatedUser);
  });

  it('should log and resolve without throwing when the metadata write returns an error', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: null }, error: new Error('network down') });

    await expect(markUserOnboarded()).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalled();
    expect(useAuthStore.getState().supabaseUser).toBeNull();
  });

  it('should log and resolve without throwing when the metadata write throws', async () => {
    mockUpdateUser.mockRejectedValue(new Error('offline'));

    await expect(markUserNeedsOnboarding()).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalled();
  });

  it('should skip the write for an Internet Identity user who has no Supabase account', async () => {
    useAuthStore.setState({ authMethod: 'ii' });

    await markUserOnboarded();

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
