// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthStore } from '@/stores/authStore';
import { clearLegacyOnboardingKeys } from '@/utils/legacyOnboardingKeys';
import { decideRoleSelection } from './onboardingRedirect';

export const ROLE_SELECTION_PATH = '/onboarding/role';

export interface TransactionsLoadState {
  transactionsLoaded: boolean;
  transactionsLoading: boolean;
  transactionsError: string | null;
  transactionCount: number;
}

export function useRoleSelectionRedirect(tx: TransactionsLoadState): void {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const principalId = useAuthStore((s) => s.principalId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authMethod = useAuthStore((s) => s.authMethod);
  const metadata = useAuthStore((s) => s.supabaseUser?.user_metadata);
  const hasDecided = useRef(false);

  useEffect(() => {
    clearLegacyOnboardingKeys();
  }, []);

  useEffect(() => {
    if (hasDecided.current || !principalId || !isAuthenticated) return;
    const decision = decideRoleSelection({
      adminLoading,
      isAdmin,
      txLoading: !tx.transactionsLoaded || tx.transactionsLoading,
      txError: tx.transactionsError,
      txCount: tx.transactionCount,
      metadata,
      authMethod,
    });
    if (decision === 'wait') return;
    hasDecided.current = true;
    if (decision === 'role-selection') navigate(ROLE_SELECTION_PATH);
  }, [
    principalId, isAuthenticated, adminLoading, isAdmin, authMethod, metadata, navigate,
    tx.transactionsLoaded, tx.transactionsLoading, tx.transactionsError, tx.transactionCount,
  ]);
}
