// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Data + resend orchestration for ListingPartiesSection, extracted so the
 * component's own body stays under the 50-line declaration-to-close budget.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { partyRoleService, type PartyRoleRow } from '@/services/partyRole.service';
import { partyInviteService, type PartyInviteRow } from '@/services/partyInvite.service';
import type { DealSide } from '@/services/shareParty.service';

export type SideStatus = 'joined' | 'invited' | 'none';

function sideStatus(side: DealSide, roles: PartyRoleRow[], invites: PartyInviteRow[]): SideStatus {
  if (roles.some((r) => r.role === side)) return 'joined';
  if (invites.some((i) => i.role === side)) return 'invited';
  return 'none';
}

interface PartyQueries {
  roles: PartyRoleRow[];
  invites: PartyInviteRow[];
  isLoading: boolean;
  invalidate: () => void;
}

/** The two ['tx-parties', …] / ['tx-invites', …] queries + their shared invalidation. */
function usePartyQueries(transactionId: string): PartyQueries {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading: isRolesLoading } = useQuery({
    queryKey: ['tx-parties', transactionId],
    queryFn: () => partyRoleService.listForTransaction(transactionId),
  });
  const { data: invites = [], isLoading: isInvitesLoading } = useQuery({
    queryKey: ['tx-invites', transactionId],
    queryFn: () => partyInviteService.listForTransaction(transactionId),
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['tx-parties', transactionId] });
    queryClient.invalidateQueries({ queryKey: ['tx-invites', transactionId] });
  };

  return { roles, invites, isLoading: isRolesLoading || isInvitesLoading, invalidate };
}

/** Which side a resend failed for, and the message to surface under its chip. */
export interface ResendError {
  side: DealSide;
  message: string;
}

export interface UseListingPartiesResult {
  roles: PartyRoleRow[];
  isLoading: boolean;
  sellerStatus: SideStatus;
  buyerStatus: SideStatus;
  sellerInvite: PartyInviteRow | undefined;
  buyerInvite: PartyInviteRow | undefined;
  resendingSide: DealSide | null;
  resendError: ResendError | null;
  handleResend: (side: DealSide, invite: PartyInviteRow) => void;
  invalidate: () => void;
}

export function useListingParties(
  transactionId: string,
  inviteCode: string | null,
  listingId: string,
  propertyAddress: string,
): UseListingPartiesResult {
  const { roles, invites, isLoading, invalidate } = usePartyQueries(transactionId);
  const [resendingSide, setResendingSide] = useState<DealSide | null>(null);
  const [resendError, setResendError] = useState<ResendError | null>(null);

  const handleResend = async (side: DealSide, invite: PartyInviteRow): Promise<void> => {
    if (!inviteCode) return;
    setResendingSide(side);
    setResendError(null);
    const result = await partyInviteService.send({
      transactionId,
      inviteCode,
      role: side,
      side,
      recipientName: invite.recipient_name,
      recipientEmail: invite.recipient_email,
      listingId,
      propertyAddress,
    });
    setResendingSide(null);
    if (!result.ok) {
      setResendError({ side, message: result.error ?? 'Invite could not be resent' });
      return;
    }
    invalidate();
  };

  return {
    roles,
    isLoading,
    sellerStatus: sideStatus('seller', roles, invites),
    buyerStatus: sideStatus('buyer', roles, invites),
    sellerInvite: invites.find((i) => i.role === 'seller'),
    buyerInvite: invites.find((i) => i.role === 'buyer'),
    resendingSide,
    resendError,
    handleResend,
    invalidate,
  };
}
