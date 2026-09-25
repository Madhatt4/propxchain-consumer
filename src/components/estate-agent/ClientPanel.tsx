// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The client panel on a listing (spec docs/plans/2026-09-06-agent-crm-spec.md,
 * R1.3, R2.1, R2.5): who the agency is dealing with on each side, whether
 * they have let the agency act for them, and the one button that asks.
 * Names and emails here are the ones the agent typed into the invite; the
 * delegation state is the platform's answer.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useListingParties } from '@/hooks/useListingParties';
import type { PartyInviteRow } from '@/services/partyInvite.service';
import { currentDelegationFor, DelegationError, listDelegations, requestDelegation, type DelegationRow } from '@/services/delegation.service';
import type { DealSide } from '@/services/shareParty.service';

interface ClientPanelProps {
  transactionId: string;
  inviteCode: string | null;
  listingId: string;
  propertyAddress: string;
}

const BUTTON_CLASS =
  'inline-flex min-h-9 items-center rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white hover:bg-[#0F766E] disabled:opacity-60';

const REQUEST_ERRORS: Record<string, string> = {
  client_unknown: 'Invite them to the deal first, then ask.',
  agent_principal_unknown: 'Open the deal once in the workspace so it knows you, then ask again.',
  already_requested: 'Already asked. They will see it when they tap the email.',
  forbidden: 'Only members of this agency can ask.',
};

function StatusChip({ delegation, side }: { delegation: DelegationRow | null; side: DealSide }): JSX.Element {
  if (delegation?.state === 'active') {
    return <span data-testid={`client-status-${side}`} className="rounded-full border border-[#0D9488]/30 bg-[#CCFBF1]/30 px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[#0F766E]">Acting for the {side}</span>;
  }
  if (delegation?.state === 'requested') {
    return <span data-testid={`client-status-${side}`} className="rounded-full border border-[#D97706]/40 bg-[#FFF7ED] px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[#9A3412] dark:border-[#D97706]/50 dark:bg-[#D97706]/10 dark:text-[#FDBA74]">Asked, waiting for their tap</span>;
  }
  if (delegation?.state === 'revoked') {
    return <span data-testid={`client-status-${side}`} className="rounded-full border border-gray-300 px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">Withdrew their mandate</span>;
  }
  return <span data-testid={`client-status-${side}`} className="rounded-full border border-gray-200 px-2.5 py-0.5 font-[DM_Sans] text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">Handles PropXchain themselves</span>;
}

interface ClientRowProps {
  side: DealSide;
  invite: PartyInviteRow | undefined;
  delegation: DelegationRow | null;
  onAsk: (side: DealSide) => void;
  isAsking: boolean;
}

function ClientRow({ side, invite, delegation, onAsk, isAsking }: ClientRowProps): JSX.Element {
  const canAsk = !!invite && (!delegation || delegation.state === 'revoked');
  return (
    <li data-testid={`client-row-${side}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{side === 'seller' ? 'Seller' : 'Buyer'}</p>
        {invite ? (
          <>
            <p className="font-[Fraunces] text-base font-semibold text-gray-900 dark:text-gray-50">{invite.recipient_name}</p>
            <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">{invite.recipient_email}</p>
          </>
        ) : (
          <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Not invited yet</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusChip delegation={delegation} side={side} />
        {canAsk && (
          <button type="button" className={BUTTON_CLASS} disabled={isAsking} onClick={() => onAsk(side)}>
            {isAsking ? 'Asking…' : `Ask ${invite.recipient_name.trim().split(' ')[0] || `the ${side}`} to let you act for them`}
          </button>
        )}
      </div>
    </li>
  );
}

export default function ClientPanel({ transactionId, inviteCode, listingId, propertyAddress }: ClientPanelProps): JSX.Element {
  const parties = useListingParties(transactionId, inviteCode, listingId, propertyAddress);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [askingSide, setAskingSide] = useState<DealSide | null>(null);

  const { data: delegations = [], isError: isDelegationsError } = useQuery({
    queryKey: ['tx-delegations', transactionId],
    queryFn: () => listDelegations(transactionId),
  });

  const ask = useMutation({
    mutationFn: (side: DealSide) => requestDelegation({ transactionId, listingId, role: side }),
    onMutate: (side) => {
      setAskingSide(side);
      setError(null);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tx-delegations', transactionId] });
    },
    onError: (err) => {
      const code = err instanceof DelegationError ? err.code : 'request_failed';
      setError(REQUEST_ERRORS[code] ?? 'Could not send the request. Try again in a moment.');
    },
    onSettled: () => setAskingSide(null),
  });

  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700" data-testid="client-panel">
      <h2 className="font-[Fraunces] text-lg font-semibold text-gray-900 dark:text-gray-50">Your clients</h2>
      <p className="mt-1 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
        A client who lets you act for them still confirms anything with legal weight, and everything you do in their name is on the deal&apos;s trail.
      </p>
      <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
        {(['seller', 'buyer'] as const).map((side) => (
          <ClientRow
            key={side}
            side={side}
            invite={side === 'seller' ? parties.sellerInvite : parties.buyerInvite}
            delegation={currentDelegationFor(delegations, side)}
            onAsk={(s) => ask.mutate(s)}
            isAsking={askingSide === side}
          />
        ))}
      </ul>
      {isDelegationsError && (
        <p role="alert" data-testid="client-error" className="mt-2 font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">
          Could not check who acts for whom just now. Refresh to try again.
        </p>
      )}
      {error && <p role="alert" className="mt-2 font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">{error}</p>}
    </section>
  );
}
