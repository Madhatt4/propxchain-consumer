// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Principal } from '@propxchain/core-client';
import type { DashboardUser } from '../../../types/adminDashboard.types';

vi.mock('@/services/icp.service', () => {
  // Inside the factory — vi.mock is hoisted and cannot close over a top-level
  // binding. Getter and accessor share one object so the existing
  // `vi.mocked(icpService.userManagement!.x)` setup still drives the component,
  // which now reaches the actor via requireUserManagement().
  const userManagement = {
    listAdmins: vi.fn(),
    demoteAdmin: vi.fn(),
    promoteAdmin: vi.fn(),
  };
  return {
    icpService: {
      userManagement,
      requireUserManagement: vi.fn(async () => userManagement),
    },
  };
});

vi.mock('@/hooks/useIsAdmin', () => ({
  useIsAdmin: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { icpService } from '@/services/icp.service';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { UsersPanel } from '../UsersPanel';

const ADMIN_PRINCIPAL = 'aaaaa-aa';
const PLAIN_PRINCIPAL = 'lkbe7-bbbbb-ccccc-ddddd-eee';

const users: DashboardUser[] = [
  {
    id: '1',
    email: 'admin@example.com',
    name: 'Admin Person',
    principal: ADMIN_PRINCIPAL,
    role: 'Buyer',
    userType: 'Buyer',
    isVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    authMethod: 'II',
  },
  {
    id: '2',
    email: 'plain@example.com',
    name: 'Plain Person',
    principal: PLAIN_PRINCIPAL,
    role: 'Seller',
    userType: 'Seller',
    isVerified: false,
    createdAt: '2026-02-01T00:00:00.000Z',
    authMethod: 'Email',
  },
];

const admins = [
  {
    principal: Principal.fromText(ADMIN_PRINCIPAL),
    role: { super: null } as { super: null },
    grantedBy: Principal.fromText(ADMIN_PRINCIPAL),
    grantedAt: 1_700_000_000_000_000_000n,
    note: [] as [],
  },
];

const renderPanel = (): ReturnType<typeof render> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPanel
        users={users}
        isLoading={false}
        csrfToken="csrf-test"
        onDeleteUser={vi.fn()}
      />
    </QueryClientProvider>,
  );
};

describe('UsersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(icpService.userManagement!.listAdmins).mockResolvedValue(admins);
    vi.mocked(useIsAdmin).mockReturnValue({
      isAdmin: true,
      role: 'super',
      isLoading: false,
    });
  });

  it('shows only admin role-grants when the Admins filter is active', async () => {
    renderPanel();

    // All view shows both users by default.
    expect(screen.getByText('Plain Person')).toBeInTheDocument();

    // Wait for the shared listAdmins query to resolve so the grant row renders.
    await waitFor(() =>
      expect(icpService.userManagement!.listAdmins).toHaveBeenCalled(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^admins$/i }));

    // Non-admin user is hidden in the Admins view.
    await waitFor(() =>
      expect(screen.queryByText('Plain Person')).not.toBeInTheDocument(),
    );

    // Admin grant surface appears: Demote action + Granted by column header.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /demote/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/granted by/i)).toBeInTheDocument();
  });

  it('shows all users with a role badge on admins in the All view', async () => {
    renderPanel();

    // Both users present.
    expect(screen.getByText('Admin Person')).toBeInTheDocument();
    expect(screen.getByText('Plain Person')).toBeInTheDocument();

    // Once the admin list resolves, the admin user is tagged 'super'.
    await waitFor(() => expect(screen.getByText('super')).toBeInTheDocument());
  });

  it('shows an error message in the Admins view when listAdmins query fails', async () => {
    vi.mocked(icpService.userManagement!.listAdmins).mockRejectedValue(
      new Error('Canister unavailable'),
    );

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /^admins$/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Failed to load admin list: Canister unavailable/i),
      ).toBeInTheDocument(),
    );

    // AdminGrantsTable should NOT be rendered when errored.
    expect(screen.queryByText(/granted by/i)).not.toBeInTheDocument();
  });
});
