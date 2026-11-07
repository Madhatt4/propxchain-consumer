// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The seller's side of adding their estate agent to a deal. The invite is
 * written by the `agent-invite` edge function, never by the browser: it checks
 * the seller's principal proof against the deal's seller on-chain, stores only
 * a hash of the code, and emails the agent a link to /agent/join/<code>.
 * The seller reads their own invites directly (row-level security: the
 * inviter only, and only the columns below).
 */
import { supabase } from '../lib/supabase';
import { buildPrincipalProof } from './principalProof';
import type { PrincipalProof } from './principalProof';

const FN = 'agent-invite';

export type AgentInviteStatus = 'pending' | 'accepted' | 'cancelled';

export interface AgentInvite {
  id: string;
  agentEmail: string;
  agencyName: string | null;
  status: AgentInviteStatus;
  createdAt: string;
  expiresAt: string;
}

interface AgentInviteDbRow {
  id: string;
  agent_email: string;
  agency_name: string | null;
  status: AgentInviteStatus;
  created_at: string;
  expires_at: string;
}

export class AgentInviteError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AgentInviteError';
  }
}

async function readFailure(error: unknown): Promise<AgentInviteError> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  try {
    const body = (await ctx?.json?.()) as { error?: unknown } | undefined;
    if (body && typeof body.error === 'string') return new AgentInviteError(body.error);
  } catch {
    // fall through to the generic code
  }
  return new AgentInviteError('request_failed');
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw await readFailure(error);
  if (data === null || data === undefined) throw new AgentInviteError('empty_response');
  return data;
}

/** The seller's invites on this deal, newest first. Only columns the policy grants are named. */
export async function listAgentInvites(transactionId: string): Promise<AgentInvite[]> {
  const { data, error } = await supabase
    .from('agent_invites')
    .select('id, agent_email, agency_name, status, created_at, expires_at')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });
  if (error) throw new AgentInviteError('load_failed');
  return ((data ?? []) as AgentInviteDbRow[]).map((r) => ({
    id: r.id, agentEmail: r.agent_email, agencyName: r.agency_name, status: r.status, createdAt: r.created_at, expiresAt: r.expires_at,
  }));
}

/** The invite that is still open: pending and in date. */
export function openInvite(invites: readonly AgentInvite[], now: Date = new Date()): AgentInvite | null {
  return invites.find((i) => i.status === 'pending' && new Date(i.expiresAt).getTime() > now.getTime()) ?? null;
}

export interface SendAgentInviteInput {
  transactionId: string;
  agentEmail: string;
  agencyName?: string;
  propertyAddress?: string;
}

/** Proves the seller's principal, bound to the deal and the signed-in user, then asks the platform to send the invite. */
export async function sendAgentInvite(input: SendAgentInviteInput): Promise<{ inviteId: string; expiresAt: string }> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new AgentInviteError('unauthorized');
  let proof: PrincipalProof;
  try {
    proof = await buildPrincipalProof(`agent-invite:create:${input.transactionId}:${userId}`);
  } catch {
    throw new AgentInviteError('no_identity');
  }
  return invoke<{ inviteId: string; expiresAt: string }>({
    action: 'create',
    transactionId: input.transactionId,
    agentEmail: input.agentEmail,
    agencyName: input.agencyName || null,
    propertyAddress: input.propertyAddress || null,
    ...proof,
  });
}

export async function cancelAgentInvite(inviteId: string): Promise<void> {
  await invoke<{ state: string }>({ action: 'cancel', inviteId });
}

/** What each refusal means to the seller. */
export const SEND_ERROR_COPY: Record<string, string> = {
  not_the_seller: 'Only the seller on this sale can add an estate agent.',
  invite_pending: 'You already have an invitation waiting. Cancel it to send a new one.',
  invalid_body: 'Check the email address and try again.',
  email: 'The invitation email could not be sent. Try again in a moment.',
  no_identity: 'Your account is still being set up. Refresh the page and try again.',
  rate_limited: 'Too many attempts. Try again later.',
};
