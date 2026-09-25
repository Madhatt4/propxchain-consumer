// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Who is acting for whom on a deal, from the viewer's side (spec
 * docs/plans/2026-09-06-agent-crm-spec.md, R2.1, R2.5): an agency member sees
 * the sides their agency acts for (often the seller first, later both); a
 * client sees the mandate they granted, with the agency's name from the
 * platform. Display only: the on-behalf records look the mandate up
 * themselves, so a save on any route counts.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { listDelegations, loadDelegationStatus, type DelegationRow } from '@/services/delegation.service';
import type { DealSide } from '@/services/shareParty.service';

export interface Mandate {
  /** The sides the viewer's agency acts for on this deal; empty for everyone else. */
  actingFor: DealSide[];
  /** The active mandate the viewer granted for their own role, or null. */
  grantedByMe: DelegationRow | null;
  agencyName: string | null;
  isLoading: boolean;
}

export function useMandate(transactionId: string | undefined, myRole: DealSide): Mandate {
  const userId = useAuthStore((s) => s.supabaseUser?.id ?? null);
  const { organisationId } = useEstateAgentOrg();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['tx-delegations', transactionId],
    enabled: !!transactionId,
    queryFn: () => listDelegations(transactionId!),
  });
  const active = rows.filter((r) => r.state === 'active');
  const actingFor = organisationId ? [...new Set(active.filter((r) => r.granteeOrgId === organisationId).map((r) => r.role))] : [];
  const grantedByMe = userId ? active.find((r) => r.role === myRole && r.grantorUserId === userId) ?? null : null;

  const { data: status } = useQuery({
    queryKey: ['delegation-status', grantedByMe?.id],
    enabled: !!grantedByMe,
    queryFn: () => loadDelegationStatus(grantedByMe!.id),
  });

  return { actingFor, grantedByMe, agencyName: status?.agencyName ?? null, isLoading };
}
