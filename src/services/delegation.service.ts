// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * A client letting an estate agency act for them on a deal (spec
 * docs/plans/2026-09-06-agent-crm-spec.md, R2.2). Every call goes through
 * the monorepo's `agent-delegation` function: the platform records requests,
 * grants and revocations, sets the delegate on-chain and anchors the ledger.
 * Granting carries a principal proof, the same #130 signature the party-role
 * flow uses, bound to the delegation and the signed-in user.
 */
import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { buildPrincipalProof } from './principalProof';
import type { DealSide } from './shareParty.service';

const FN = 'agent-delegation';

export type DelegationState = 'requested' | 'active' | 'revoked';

export interface DelegationStatus {
  id: string;
  transactionId: string;
  role: DealSide;
  state: DelegationState;
  agencyName: string;
  propertyAddress: string | null;
  inviteCode: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  ledgerPending: boolean;
}

export interface DelegationOutcome {
  state: DelegationState;
  ledgerPending: boolean;
}

export class DelegationError extends Error {
  constructor(public readonly code: string, public readonly payload: Record<string, unknown> = {}) {
    super(code);
    this.name = 'DelegationError';
  }
}

async function readFailure(error: unknown): Promise<DelegationError> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as Record<string, unknown> | null;
      if (body && typeof body.error === 'string') return new DelegationError(body.error, body);
    } catch {
      // fall through to the generic code
    }
  }
  return new DelegationError('request_failed');
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw await readFailure(error);
  // The function always answers with a JSON object on 2xx; an empty body is a platform fault, not a state.
  if (data === null || data === undefined) throw new DelegationError('empty_response');
  return data as T;
}

/** What the confirm page and the panels show; served by the platform because the client may not be a party yet. */
export async function loadDelegationStatus(delegationId: string): Promise<DelegationStatus> {
  const res = await invoke<{ delegation: DelegationStatus }>({ action: 'status', delegationId });
  return res.delegation;
}

/** The agent asks the client; the platform emails the one-tap link. */
export async function requestDelegation(input: { transactionId: string; listingId: string; role: DealSide }): Promise<{ delegationId: string; clientEmailMasked: string }> {
  return invoke<{ delegationId: string; clientEmailMasked: string }>({ action: 'request', ...input });
}

async function signedInUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new DelegationError('unauthorized');
  return id;
}

async function joinByInvite(inviteCode: string, role: DealSide): Promise<void> {
  let result: unknown;
  try {
    result = role === 'buyer'
      ? await icpService.joinTransactionByInviteCodeAsBuyer(inviteCode)
      : await icpService.joinTransactionByInviteCode(inviteCode);
  } catch (err) {
    // The canister call itself failed (network, agent): still a join failure to the client.
    throw new DelegationError('join_failed', { detail: err instanceof Error ? err.message : String(err) });
  }
  if (result && typeof result === 'object' && 'err' in result) {
    throw new DelegationError('join_failed', { detail: String((result as { err: unknown }).err) });
  }
}

/**
 * The button on the confirm page. Proves the client's principal, and if the
 * client has not joined the deal on-chain yet, joins by the agent's invite
 * code first and grants again. Nothing is granted without this call.
 */
export async function grantDelegation(delegationId: string): Promise<DelegationOutcome> {
  const userId = await signedInUserId();
  const attempt = async (): Promise<DelegationOutcome> => {
    const proof = await buildPrincipalProof(`agent-delegation:grant:${delegationId}:${userId}`);
    return invoke<DelegationOutcome>({ action: 'grant', delegationId, ...proof });
  };
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof DelegationError && err.code === 'not_yet_on_chain') {
      const inviteCode = typeof err.payload.inviteCode === 'string' ? err.payload.inviteCode : null;
      if (!inviteCode) throw new DelegationError('no_invite');
      const status = await loadDelegationStatus(delegationId);
      await joinByInvite(inviteCode, status.role);
      return attempt();
    }
    throw err;
  }
}

/** From the client's own page; the platform takes the delegate off the chain and anchors the revocation. */
export async function revokeDelegation(delegationId: string): Promise<DelegationOutcome> {
  return invoke<DelegationOutcome>({ action: 'revoke', delegationId });
}

/** The agent set the searches up; the platform emails the client Stripe's page, reading the amount from the session itself (spec I3). */
export async function sendPaymentLink(input: { transactionId: string; role: DealSide; sessionId: string; propertyAddress: string }): Promise<{ sentTo: string; amountPence: number }> {
  return invoke<{ sentTo: string; amountPence: number }>({ action: 'send_payment_link', ...input });
}

/** A delegation as the agency sees it (RLS: members of the grantee agency, and the deal's parties). */
export interface DelegationRow {
  id: string;
  transactionId: string;
  role: DealSide;
  state: DelegationState;
  requestedAt: string;
  grantedAt: string | null;
  revokedAt: string | null;
  granteeOrgId: string;
  grantorUserId: string;
}

interface DelegationDbRow {
  id: string;
  transaction_id: string;
  grantor_role: DealSide;
  requested_at: string;
  granted_at: string | null;
  revoked_at: string | null;
  grantee_org_id: string;
  grantor_user_id: string;
}

function stateOf(r: Pick<DelegationDbRow, 'granted_at' | 'revoked_at'>): DelegationState {
  if (r.revoked_at) return 'revoked';
  if (r.granted_at) return 'active';
  return 'requested';
}

function fromDbRow(r: DelegationDbRow): DelegationRow {
  return {
    id: r.id, transactionId: r.transaction_id, role: r.grantor_role, state: stateOf(r), requestedAt: r.requested_at,
    grantedAt: r.granted_at, revokedAt: r.revoked_at, granteeOrgId: r.grantee_org_id, grantorUserId: r.grantor_user_id,
  };
}

const DELEGATION_COLUMNS = 'id, transaction_id, grantor_role, requested_at, granted_at, revoked_at, grantee_org_id, grantor_user_id';

export async function listDelegations(transactionId: string): Promise<DelegationRow[]> {
  const { data, error } = await supabase
    .from('party_delegations')
    .select(DELEGATION_COLUMNS)
    .eq('transaction_id', transactionId)
    .order('requested_at', { ascending: false });
  if (error) throw new Error(`Failed to load delegations: ${error.message}`);
  return ((data ?? []) as DelegationDbRow[]).map(fromDbRow);
}

/** Every delegation an agency holds, for the chase list's badges. */
export async function listDelegationsForOrg(orgId: string): Promise<DelegationRow[]> {
  const { data, error } = await supabase
    .from('party_delegations')
    .select(DELEGATION_COLUMNS)
    .eq('grantee_org_id', orgId)
    .order('requested_at', { ascending: false });
  if (error) throw new Error(`Failed to load delegations: ${error.message}`);
  return ((data ?? []) as DelegationDbRow[]).map(fromDbRow);
}

/** The delegation that counts for a role: the newest one not yet revoked, else the newest of all. */
export function currentDelegationFor(rows: readonly DelegationRow[], role: DealSide): DelegationRow | null {
  const ofRole = rows.filter((r) => r.role === role);
  return ofRole.find((r) => r.state !== 'revoked') ?? ofRole[0] ?? null;
}
