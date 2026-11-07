// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Add your estate agent" on the seller's transaction page. The seller types
 * the agent's email; the agent gets a link that adds the sale to their agent
 * dashboard, signing them up first if they are not on PropXchain yet. Once
 * the agent accepts, MandateBanners takes over: it names the agency and
 * carries the Withdraw button, which is how the seller removes them.
 *
 * Shown only to the seller themselves: not to an agency member acting for
 * the seller (they see the acting-for banner), and not once an agency
 * already acts for this seller.
 */
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMandate } from '@/hooks/useMandate';
import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import {
  AgentInviteError, SEND_ERROR_COPY, cancelAgentInvite, listAgentInvites, openInvite, sendAgentInvite, type AgentInvite,
} from '@/services/agentInvite.service';
import type { DealSide } from '@/services/shareParty.service';

interface AddEstateAgentPanelProps {
  transactionId: string;
  myRole: DealSide;
  propertyAddress?: string;
  className?: string;
}

const PANEL = 'rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900';
const LABEL = 'block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-gray-200';
const INPUT = 'mt-1 w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2 font-[DM_Sans] text-sm text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const BUTTON = 'inline-flex min-h-10 items-center rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:opacity-60';
const LINK = 'font-[DM_Sans] text-sm text-[#0F766E] underline-offset-2 hover:underline disabled:opacity-60';

function ukDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function errorText(err: unknown): string {
  const code = err instanceof AgentInviteError ? err.code : 'request_failed';
  return SEND_ERROR_COPY[code] ?? 'Something went wrong. Try again in a moment.';
}

function PendingInvite({ invite, onCancel, isCancelling, cancelFailed, className }: {
  invite: AgentInvite; onCancel: () => void; isCancelling: boolean; cancelFailed: boolean; className: string;
}): JSX.Element {
  return (
    <section data-testid="agent-invite-pending" aria-label="Your estate agent" className={`${PANEL} ${className}`}>
      <p className="font-[DM_Sans] text-sm text-[#374151] dark:text-gray-300">
        Invitation sent to <strong>{invite.agentEmail}</strong>{invite.agencyName ? ` (${invite.agencyName})` : ''} on {ukDate(invite.createdAt)}.
        {' '}It works until {ukDate(invite.expiresAt)}. When they accept, the sale appears in their agent dashboard and they can act for you here.
      </p>
      <button type="button" className={`mt-2 ${LINK}`} disabled={isCancelling} onClick={onCancel}>
        {isCancelling ? 'Cancelling…' : 'Cancel invitation'}
      </button>
      {cancelFailed && <p role="alert" className="mt-1 font-[DM_Sans] text-sm text-[#9A3412]">Could not cancel just now. Try again in a moment.</p>}
    </section>
  );
}

function InviteForm({ onSend, isSending, sendError, className }: {
  onSend: (email: string, agencyName: string) => Promise<unknown>; isSending: boolean; sendError: unknown; className: string;
}): JSX.Element {
  const [email, setEmail] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!email.trim()) return;
    void onSend(email.trim(), agencyName.trim()).then(() => { setEmail(''); setAgencyName(''); }, () => undefined);
  };
  return (
    <section data-testid="add-estate-agent" aria-labelledby="add-estate-agent-title" className={`${PANEL} ${className}`}>
      <h2 id="add-estate-agent-title" className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A] dark:text-white">Add your estate agent</h2>
      <p className="mt-1 font-[DM_Sans] text-sm text-[#6B7280] dark:text-gray-400">
        We email them a link. The sale appears in their agent dashboard, and they can help with forms, documents and searches for you.
        Anything with legal weight still comes to you, it is all on the audit trail, and you can withdraw it at any time.
      </p>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className={LABEL}>
          Agent&rsquo;s email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={INPUT} />
        </label>
        <label className={LABEL}>
          Agency name <span className="font-normal text-[#6B7280]">(optional)</span>
          <input type="text" maxLength={120} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className={INPUT} />
        </label>
        <button type="submit" className={BUTTON} disabled={isSending}>{isSending ? 'Sending…' : 'Send invitation'}</button>
      </form>
      {sendError ? <p role="alert" className="mt-2 font-[DM_Sans] text-sm text-[#9A3412]">{errorText(sendError)}</p> : null}
    </section>
  );
}

export function AddEstateAgentPanel({ transactionId, myRole, propertyAddress, className = '' }: AddEstateAgentPanelProps): JSX.Element | null {
  const mandate = useMandate(transactionId, myRole);
  const { organisationId } = useEstateAgentOrg();
  const queryClient = useQueryClient();
  const isSeller = myRole === 'seller' && !organisationId && mandate.actingFor.length === 0;
  const canInvite = isSeller && !mandate.isLoading && !mandate.grantedByMe;

  const invites = useQuery({
    queryKey: ['agent-invites', transactionId],
    enabled: canInvite,
    queryFn: () => listAgentInvites(transactionId),
  });
  const refresh = (): void => { void queryClient.invalidateQueries({ queryKey: ['agent-invites', transactionId] }); };
  const send = useMutation({
    mutationFn: (v: { email: string; agencyName: string }) => sendAgentInvite({ transactionId, agentEmail: v.email, agencyName: v.agencyName, propertyAddress }),
    onSuccess: refresh,
  });
  const cancel = useMutation({ mutationFn: (id: string) => cancelAgentInvite(id), onSuccess: refresh });

  if (!canInvite || invites.isLoading) return null;
  const pending = openInvite(invites.data ?? []);
  if (pending) {
    return <PendingInvite invite={pending} onCancel={() => cancel.mutate(pending.id)} isCancelling={cancel.isPending} cancelFailed={cancel.isError} className={className} />;
  }
  return (
    <InviteForm
      onSend={(email, agencyName) => send.mutateAsync({ email, agencyName })}
      isSending={send.isPending}
      sendError={send.isError ? send.error : null}
      className={className}
    />
  );
}
