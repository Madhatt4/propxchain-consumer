// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What the agency's desk knows per deal beyond the stalls: the sides it
 * currently acts for, and the soonest open next action. Two agency-wide reads,
 * folded per transaction for the chase list.
 */
import { useQuery } from '@tanstack/react-query';
import { EMPTY_DESK, type DeskSignals } from '@/components/estate-agent/chaseList';
import { listOpenNextActions } from '@/services/chaseLog.service';
import { listDelegationsForOrg } from '@/services/delegation.service';
import type { DealSide } from '@/services/shareParty.service';

export function useDeskSignals(organisationId: string | null | undefined): DeskSignals {
  const { data: delegations = [] } = useQuery({
    queryKey: ['org-delegations', organisationId],
    enabled: !!organisationId,
    queryFn: () => listDelegationsForOrg(organisationId!),
  });
  const { data: actions = [] } = useQuery({
    queryKey: ['org-next-actions', organisationId],
    enabled: !!organisationId,
    queryFn: () => listOpenNextActions(organisationId!),
  });
  if (!organisationId) return EMPTY_DESK;

  const actingForByTx: Record<string, DealSide[]> = {};
  for (const d of delegations) {
    if (d.state !== 'active') continue;
    const sides = actingForByTx[d.transactionId] ?? [];
    if (!sides.includes(d.role)) sides.push(d.role);
    actingForByTx[d.transactionId] = sides;
  }
  const nextDueByTx: Record<string, string> = {};
  for (const a of actions) {
    if (!a.dueAt) continue;
    const current = nextDueByTx[a.transactionId];
    if (!current || a.dueAt < current) nextDueByTx[a.transactionId] = a.dueAt;
  }
  return { actingForByTx, nextDueByTx };
}
