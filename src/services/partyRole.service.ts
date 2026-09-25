// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * partyRole.service — records a party's role + side for a deal
 * (transaction_party_roles, wallet spec decision 15).
 *
 * Two writers, for two different proofs:
 * - `recordMyRole`: the JOINER writes about themselves under RLS, which
 *   accepts an invite received, an invite sent, or the org's listing as the
 *   link to the deal. Best-effort — a failure never blocks the join.
 * - `recordRoleFromChain`: the CREATOR has none of those links (nobody
 *   invites you to your own deal, and creating it on-chain is not a fact
 *   Postgres can check), so the monorepo-owned `record-party-role` edge
 *   function writes it instead — after a signed proof that this browser holds
 *   the principal, and from the chain record's seller/buyer slots, never from
 *   a role the client claims. Runbook: monorepo
 *   docs/runbooks/2026-09-02-transaction-party-roles-not-recorded.md.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getStorePrincipalId } from '../stores/authStore';
import { buildPrincipalProof } from './principalProof';
import type { PrincipalProof } from './principalProof';
import type { DealSide, PartyRole } from './shareParty.service';
import { logger } from '@/utils/logger';

/** Postgres `insufficient_privilege` — how PostgREST surfaces an RLS policy denial. */
const RLS_DENIAL_CODE = '42501';

/** The monorepo-owned edge function; the same string is the proof's domain separator. */
const RECORD_FROM_CHAIN_FN = 'record-party-role';

/**
 * Refusals that will not change until the deal itself does — no point asking
 * again this session. Anything else (network, 429, 503, a chain read) may clear.
 */
const SETTLED_REFUSALS: ReadonlySet<string> = new Set([
  'not_a_principal_party',
  'agent_flow_owns_roles',
  'transaction_not_found',
  'no_identity',
  'unsupported_identity',
]);

const ENSURED_KEY_PREFIX = 'partyRole:ensured:';

/**
 * True when `error` is a row-level-security policy denial rather than a
 * transient failure (network blip, timeout, etc). Matches on the Postgres
 * code first — the reliable signal — and falls back to the message for any
 * path that doesn't surface a code.
 */
function isRlsDenial(error: Pick<PostgrestError, 'code' | 'message'>): boolean {
  if (error.code === RLS_DENIAL_CODE) return true;
  return typeof error.message === 'string' && error.message.toLowerCase().includes('row-level security');
}

export interface MyRoleInput {
  transactionId: string;
  principal: string;
  role: PartyRole;
  side?: DealSide | null;
  invitedBy?: string | null;
}

export interface PartyRoleRow {
  transaction_id: string;
  principal: string;
  role: PartyRole;
  side: DealSide | null;
  invited_by_principal: string | null;
  created_at: string;
}

export type ChainRoleOutcome =
  | { ok: true; role: DealSide; side: DealSide; created: boolean }
  | { ok: false; error: string };

interface ChainRoleResponse {
  ok?: boolean;
  role?: DealSide;
  side?: DealSide;
  created?: boolean;
  error?: string;
}

/** supabase-js throws on non-2xx with a generic message; the machine-readable reason is in the body. */
async function invokeErrorCode(error: {
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

/** sessionStorage is a convenience, not state — a private window just means one more call. */
function readEnsured(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markEnsured(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Storage unavailable: the next visit asks again, which is harmless.
  }
}

class PartyRoleService {
  /** Upsert my role row for a deal. Returns false (and logs) on failure. */
  async recordMyRole(input: MyRoleInput): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return false;
    const { error } = await supabase.from('transaction_party_roles').upsert(
      {
        transaction_id: input.transactionId,
        principal: input.principal,
        role: input.role,
        side: input.side ?? null,
        invited_by_principal: input.invitedBy ?? null,
        user_id: userId,
      },
      { onConflict: 'transaction_id,principal' },
    );
    if (error) {
      if (isRlsDenial(error)) {
        logger.error(
          `[partyRole] RLS denied recording role for transaction ${input.transactionId} — caller has no provable link to this transaction`,
          error,
        );
      } else {
        logger.warn('[partyRole] could not record role', error);
      }
      return false;
    }
    return true;
  }

  /** All role rows for a deal, under RLS. Plain select — no auth call needed. */
  async listForTransaction(transactionId: string): Promise<PartyRoleRow[]> {
    const { data, error } = await supabase
      .from('transaction_party_roles')
      .select('transaction_id, principal, role, side, invited_by_principal, created_at')
      .eq('transaction_id', transactionId);
    if (error) throw new Error(`Failed to fetch party roles: ${error.message}`);
    return (data ?? []) as PartyRoleRow[];
  }

  /**
   * Ask the chain-verified writer to record my row for a deal I hold the
   * seller or buyer slot on. Returns the refusal code rather than throwing so
   * callers can stay fire-and-forget.
   */
  async recordRoleFromChain(transactionId: string): Promise<ChainRoleOutcome> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return { ok: false, error: 'no_session' };

    let proof: PrincipalProof;
    try {
      proof = await buildPrincipalProof(`${RECORD_FROM_CHAIN_FN}:${transactionId}:${userId}`);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'proof_failed';
      logger.warn(`[partyRole] could not build a principal proof for ${transactionId}: ${code}`);
      return { ok: false, error: code };
    }

    const { data: res, error } = await supabase.functions.invoke<ChainRoleResponse>(RECORD_FROM_CHAIN_FN, {
      body: { transactionId, ...proof },
    });
    if (error) {
      const code = await invokeErrorCode(error);
      logger.warn(`[partyRole] ${RECORD_FROM_CHAIN_FN} refused ${transactionId}: ${code}`);
      return { ok: false, error: code };
    }
    if (!res?.ok || !res.role || !res.side) {
      return { ok: false, error: res?.error ?? 'unexpected_response' };
    }
    return { ok: true, role: res.role, side: res.side, created: res.created === true };
  }

  /**
   * Self-heal on the transaction page: when I have no row on this deal, ask
   * the chain-verified writer, at most once per tab session per deal. This is
   * also the backfill for deals created before that writer existed — the
   * server has no trustworthy principal→user binding to do it unattended.
   */
  async ensureMyRoleFromChain(transactionId: string): Promise<void> {
    const key = ENSURED_KEY_PREFIX + transactionId;
    if (readEnsured(key)) return;
    const principal = getStorePrincipalId();
    if (!principal) return;

    let rows: PartyRoleRow[];
    try {
      rows = await this.listForTransaction(transactionId);
    } catch (err) {
      logger.warn('[partyRole] could not check for my party row', err);
      return;
    }
    if (rows.some((row) => row.principal === principal)) {
      markEnsured(key);
      return;
    }

    const outcome = await this.recordRoleFromChain(transactionId);
    if (outcome.ok || SETTLED_REFUSALS.has(outcome.error)) markEnsured(key);
  }
}

export const partyRoleService = new PartyRoleService();
