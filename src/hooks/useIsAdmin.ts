// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { icpService } from '@/services/icp.service';

export type AdminRoleString = 'super' | 'regular' | null;

interface UseIsAdminResult {
  isAdmin: boolean;
  role: AdminRoleString;
  isLoading: boolean;
}

/**
 * Reads admin status from the user_management canister's `admins` stable map
 * (single source of truth). Orthogonal to `userType`.
 *
 * - `isAdmin` is true when `amIAdmin()` returns true (covers both regular and
 *   super admins, plus the controller emergency principal fast-path).
 * - `role` is `'super' | 'regular' | null` derived from `myAdminRole()`'s
 *   Candid optional variant: `?AdminRole = [] | [{ super: null } | { regular: null }]`.
 */
export function useIsAdmin(): UseIsAdminResult {
  const principalId = useAuthStore((s) => s.principalId);

  const { data, isLoading } = useQuery({
    queryKey: ['amIAdmin', principalId],
    queryFn: async () => {
      const isAdmin = await (await icpService.requireUserManagement()).amIAdmin();
      if (!isAdmin) {
        return { isAdmin: false, role: null as AdminRoleString };
      }
      const roleOpt = await (await icpService.requireUserManagement()).myAdminRole();
      // Candid: ?AdminRole = [] | [{ super: null } | { regular: null }]
      const role: AdminRoleString =
        roleOpt.length === 0
          ? null
          : 'super' in roleOpt[0]
            ? 'super'
            : 'regular';
      return { isAdmin: true, role };
    },
    enabled: !!principalId,
    staleTime: 60_000,
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    role: data?.role ?? null,
    isLoading,
  };
}
