// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * partyInvite.service — sends and lists party invites for a deal
 * (party_invites, wallet spec decision 15). `send` calls the deployed
 * `send-party-invite` edge function, which derives the inviter from the
 * caller's JWT — never send `invited_by` from the client. Errors (transport
 * or application-level) are surfaced, never thrown, so callers can show
 * inline feedback without a try/catch.
 */
import { supabase } from '../lib/supabase';
import type { DealSide } from './shareParty.service';
import type { InviteRole } from '@/utils/inviteContext';

export interface SendPartyInviteInput {
  transactionId: string;
  inviteCode: string;
  role: InviteRole;
  side?: DealSide;
  recipientName: string;
  recipientEmail: string;
  listingId: string;
  propertyAddress: string;
}

export interface SendPartyInviteResult {
  ok: boolean;
  error: string | null;
}

export interface PartyInviteRow {
  id: string;
  transaction_id: string;
  invite_code: string;
  role: string;
  side: string | null;
  recipient_name: string;
  recipient_email: string;
  email_sent: boolean;
  created_at: string;
}

interface SendPartyInviteResponse {
  ok?: boolean;
  invite_id?: string;
  error?: string;
}

/** send-party-invite returns every failure (401/403/400/429/502) as a
 *  non-2xx response, so supabase-js throws a FunctionsHttpError whose
 *  `.message` is just 'Edge Function returned a non-2xx status code' — the
 *  real reason (e.g. 'not_a_party', 'rate_limited') is in the response body,
 *  reachable via `error.context` (a Response-like object). Falls back to
 *  `error.message` when the body can't be parsed as JSON. */
async function extractInvokeErrorMessage(error: {
  message: string;
  context?: { json?: () => Promise<{ error?: string }> };
}): Promise<string> {
  try {
    const body = await error.context?.json?.();
    return body?.error ?? error.message;
  } catch {
    return error.message;
  }
}

class PartyInviteService {
  /** Send a party invite via the send-party-invite edge function. */
  async send(input: SendPartyInviteInput): Promise<SendPartyInviteResult> {
    try {
      const { data, error } = await supabase.functions.invoke<SendPartyInviteResponse>('send-party-invite', {
        body: {
          transaction_id: input.transactionId,
          invite_code: input.inviteCode,
          role: input.role,
          ...(input.side ? { side: input.side } : {}),
          recipient_name: input.recipientName,
          recipient_email: input.recipientEmail,
          listing_id: input.listingId,
          property_address: input.propertyAddress,
        },
      });
      if (error) return { ok: false, error: await extractInvokeErrorMessage(error) };
      if (!data?.ok) return { ok: false, error: data?.error ?? 'Invite could not be sent' };
      return { ok: true, error: null };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invite could not be sent' };
    }
  }

  /** Invites the current user sent for this deal, under RLS (own invites only). */
  async listForTransaction(transactionId: string): Promise<PartyInviteRow[]> {
    const { data, error } = await supabase
      .from('party_invites')
      .select('id, transaction_id, invite_code, role, side, recipient_name, recipient_email, email_sent, created_at')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch party invites: ${error.message}`);
    return (data ?? []) as PartyInviteRow[];
  }
}

export const partyInviteService = new PartyInviteService();
