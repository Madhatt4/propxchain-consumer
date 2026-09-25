// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/icp.service', () => {
  // Declared inside the factory: vi.mock is hoisted, so it cannot close over a
  // top-level binding. The getter and the accessor return the same object, so
  // `vi.mocked(icpService.userManagement!.amIAdmin)` still drives the call the
  // hook now makes via requireUserManagement().
  const userManagement = {
    amIAdmin: vi.fn(),
    myAdminRole: vi.fn(),
  };
  return {
    icpService: {
      userManagement,
      requireUserManagement: vi.fn(async () => userManagement),
    },
  };
});

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { principalId: string | null }) => unknown) =>
    selector({ principalId: 'lkbe7-test-principal' }),
}));

import { icpService } from '@/services/icp.service';
import { useIsAdmin } from '../useIsAdmin';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useIsAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isAdmin=false, role=null when canister says not admin', async () => {
    vi.mocked(icpService.userManagement!.amIAdmin).mockResolvedValue(false);
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBe(null);
  });

  it('returns isAdmin=true, role=super for super-admin', async () => {
    vi.mocked(icpService.userManagement!.amIAdmin).mockResolvedValue(true);
    vi.mocked(icpService.userManagement!.myAdminRole).mockResolvedValue([
      { super: null },
    ]);
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe('super');
  });

  it('returns isAdmin=true, role=regular for regular admin', async () => {
    vi.mocked(icpService.userManagement!.amIAdmin).mockResolvedValue(true);
    vi.mocked(icpService.userManagement!.myAdminRole).mockResolvedValue([
      { regular: null },
    ]);
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe('regular');
  });
});
