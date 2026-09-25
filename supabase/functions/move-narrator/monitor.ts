/**
 * monitor_fire — the server-side nudge path for the transaction-monitor cron
 * (Bearer-secret gated in index.ts, see its module header). There is no
 * authenticated end user on this path, so the recipient can't come from a
 * verified session the way `fire`/`deliver` derive it (audit 2026-07-25,
 * finding #2). Instead this resolves the transaction's OWN buyer/seller
 * parties server-side and delivers to each one's own registered contact
 * details — never to a monitor-chosen destination, preserving that same
 * invariant.
 *
 * ROSTER SOURCE (investigated, not guessed — see task-5-report.md for the
 * full trail): `public.transaction_party_roles` (Wallet PR 2 — this repo's
 * own `supabase/migrations/20260824_party_roles_read_scope.sql` tightens its
 * RLS, and `src/services/partyRole.service.ts`'s `recordMyRole`/
 * `listForTransaction` show the columns actually in use) already carries
 * `transaction_id`, `role` ('buyer'|'seller'|...) and `user_id` (an
 * `auth.users` foreign key) in the SAME shared Supabase project this
 * function deploys to. That is a more direct path than going through
 * `raw_user_meta_data->>'icp_principal'` — no principal round-trip needed —
 * and the service-role client bypasses its RLS the same way it already
 * bypasses `transaction_telemetry`'s. See the TRUST GAP comment at
 * `resolveTransactionRoster` below for what this roster does NOT prove.
 *
 * PREMIUM CHECK (controller ruling, 2026-08-29 — supersedes this file's
 * original fail-closed stub): `public.ai_scan_entitlements` — the SAME
 * shared-project table `_shared/scan-entitlement.ts`'s `isScanEntitled`
 * reads for search-scan/survey-scan/hmlr-scan — is the platform's one
 * real, already-used, server-side premium-entitlement table: default DENY
 * (absence of a row means not entitled), keyed by `user_id`, and
 * deliberately not derived from anything the client claims. It is a PROXY
 * for the £75 tier until a dedicated tier-specific source exists — swap
 * `isPremiumUser`'s query for that source in one line when it does. Fails
 * closed on any lookup error or missing row, same rationale as
 * `isScanEntitled`: an unavailable check must not become a free pass.
 * `filterPremiumRoster` takes the check as an injectable parameter so the
 * roster-filtering LOOP is unit-testable independently of this table.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { emitTelemetry } from '../_shared/telemetry.ts';
import { deliverNarration, recipientFromUser } from './delivery.ts';
import { fetchNarrationOutputs, fireNarration, getSessionStatus, isSettled } from './narrator.ts';
import type { MonitorFireAction, NextStepRecommendation, TransactionContext } from './types.ts';

export interface RosterParty {
  userId: string;
  role: 'buyer' | 'seller';
}

/**
 * TRUST GAP (flagged in review, 2026-08-29): `transaction_party_roles` is
 * self-writable — the public `recordMyRole` RPC
 * (`src/services/partyRole.service.ts`) lets ANY authenticated user upsert a
 * row for ANY `transaction_id`, claiming role='buyer'/'seller' about
 * themselves (`supabase/functions/send-party-invite/index.ts:221-223` makes
 * the identical point for why THAT function never gates authorisation on
 * this table alone). So a row here is NOT proof the user is actually a party
 * to the transaction — it only proves they claimed to be.
 *
 * The exposure is bounded, not unbounded: exploiting it requires (1) an
 * authenticated Supabase account that (2) already holds an
 * `ai_scan_entitlements` row (the premium filter below still gates
 * delivery), and even then leaks only this transaction's blocker key +
 * urgency enum (never PII, never the drafted notification text) at the cost
 * of one Anthropic run plus a possible email/SMS send. `runMonitorFire`'s
 * `MAX_PREMIUM_PARTIES_PER_INVOCATION` cap is an INTERIM bound on how much
 * of that spend one fabricated roster row can trigger per invocation — it is
 * NOT the fix. The structural fix is RLS/authz on `transaction_party_roles`
 * itself (only a genuine party — or nobody client-writable — should be able
 * to insert); tracked on the DevOps board.
 */
// `transaction_party_roles` is self-writable (see TRUST GAP above), so an
// attacker can insert an unbounded number of rows against one transaction id
// to force an unbounded number of sequential `ai_scan_entitlements` lookups
// in `filterPremiumRoster` below (that loop runs BEFORE the
// MAX_PREMIUM_PARTIES_PER_INVOCATION cap, so the cap alone doesn't bound it).
// 10 is generous for legitimate joint-owner rosters while still bounding the
// per-invocation work an attacker can force.
const MAX_ROSTER_ROWS = 10;

export async function resolveTransactionRoster(svc: SupabaseClient, txId: string): Promise<RosterParty[]> {
  const { data, error } = await svc
    .from('transaction_party_roles')
    .select('user_id, role')
    .eq('transaction_id', txId)
    .in('role', ['buyer', 'seller'])
    // Oldest-first: genuine parties are recorded at transaction setup, so this
    // sorts them ahead of any later self-inserted row before the premium cap
    // (MAX_PREMIUM_PARTIES_PER_INVOCATION) picks who gets fired — reduces the
    // cap-displacement risk noted on DevOps card 3463e5cd.
    .order('created_at', { ascending: true })
    .limit(MAX_ROSTER_ROWS);

  if (error) {
    console.error('monitor_fire: roster lookup failed; treating as no parties:', error.message);
    return [];
  }

  return ((data as Array<{ user_id: string; role: string }> | null) ?? []).map((r) => ({
    userId: r.user_id,
    role: r.role as 'buyer' | 'seller',
  }));
}

/**
 * `ai_scan_entitlements` is the platform's premium-entitlement table — a
 * proxy for the £75 tier until a dedicated tier source exists (one-line
 * swap when it does; see module header). Default DENY: a lookup error or
 * missing row is treated as not-premium, never premium.
 */
export async function isPremiumUser(svc: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await svc
    .from('ai_scan_entitlements')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error(`monitor_fire: premium entitlement lookup failed for ${userId}; denying:`, error.message);
    return false;
  }
  return Boolean(data);
}

/** Injectable so the filtering loop is testable independently of `isPremiumUser`'s gap. */
export async function filterPremiumRoster(
  svc: SupabaseClient,
  roster: RosterParty[],
  isPremium: (svc: SupabaseClient, userId: string) => Promise<boolean> = isPremiumUser,
): Promise<RosterParty[]> {
  const kept: RosterParty[] = [];
  for (const party of roster) {
    if (await isPremium(svc, party.userId)) kept.push(party);
  }
  return kept;
}

interface Recipient {
  email?: string;
  mobile?: string;
}

async function recipientForParty(svc: SupabaseClient, userId: string): Promise<Recipient | null> {
  const { data, error } = await svc.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    console.error(`monitor_fire: could not load auth user ${userId}:`, error?.message ?? 'not found');
    return null;
  }
  return recipientFromUser(data.user);
}

// Reduced from 6 to 4 attempts (review, 2026-08-29) so two concurrent
// parties' worst-case poll time (4 x 10s + fetch/retry overhead) stays
// comfortably inside edge-function wall-clock limits.
const POLL_ATTEMPTS = 4;
const POLL_INTERVAL_MS = 10_000;

/** Bounded poll: up to 4 attempts, 10s apart. Returns the settled status, or null if it never settled. */
async function pollUntilSettled(apiKey: string, sessionId: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const status = await getSessionStatus(apiKey, sessionId);
    if (isSettled(status)) return status;
    if (attempt < POLL_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  return null;
}

export interface AgentConfig {
  apiKey: string;
  agentId: string;
  envId: string;
}

/** Poll to settlement, then emit verdict + deliver + emit delivered. No-op if the run never settles. */
async function pollAndDeliver(
  svc: SupabaseClient,
  agent: AgentConfig,
  request: MonitorFireAction,
  sessionId: string,
  recipient: Recipient,
): Promise<void> {
  const settled = await pollUntilSettled(agent.apiKey, sessionId);
  if (!settled) return;

  await emitTelemetry(svc, {
    transactionId: request.txId,
    eventType: 'narrator_verdict',
    source: 'narrator',
    dedupeKey: `verdict:${sessionId}`,
    payload: { verdict: settled.verdict },
  });

  const outputs = await fetchNarrationOutputs(agent.apiKey, sessionId);
  const results = await deliverNarration(outputs, recipient);
  await emitTelemetry(svc, {
    transactionId: request.txId,
    eventType: 'narrator_delivered',
    source: 'narrator',
    dedupeKey: `delivered:${sessionId}`,
    payload: { channels: results.map((c) => ({ channel: c.channel, status: c.status })) },
  });
}

/**
 * Synthetic — the monitor only carries the blocker key + urgency, not the
 * human label/why/options that live in next_step.mo. `partial: true` signals
 * honestly that this is a reduced state, per the plan's "PII" note: blocker
 * keys, urgency, ids only cross this boundary.
 */
function buildSyntheticFireInputs(
  request: MonitorFireAction,
  party: RosterParty,
): { tx: TransactionContext; next: NextStepRecommendation } {
  const tx: TransactionContext = {
    txId: request.txId,
    url: `/transaction/${request.txId}`,
    role: party.role,
    propertyAddress: '',
    previousBlocker: request.previousBlocker,
  };
  const next: NextStepRecommendation = {
    blocker: request.blocker,
    blockerLabel: request.blocker,
    urgency: request.urgency,
    why: '',
    partial: true,
    options: [],
  };
  return { tx, next };
}

/**
 * Fire + bounded-poll + deliver a narration for ONE premium party. Returns
 * whether it fired (a session was started) — a poll/deliver failure AFTER a
 * successful fire still counts as fired (per-item isolation matches the
 * monitor's own chain-read tolerance). Never rejects: every failure is
 * caught and reported as `false`, so callers running many of these
 * concurrently via `Promise.allSettled` only ever see fulfilled results.
 */
export async function fireAndDeliverForParty(
  svc: SupabaseClient,
  agent: AgentConfig,
  request: MonitorFireAction,
  party: RosterParty,
): Promise<boolean> {
  try {
    const recipient = await recipientForParty(svc, party.userId);
    if (!recipient) return false;

    const { tx, next } = buildSyntheticFireInputs(request, party);
    const sessionId = await fireNarration(agent.apiKey, agent.agentId, agent.envId, tx, next);
    await emitTelemetry(svc, {
      transactionId: request.txId,
      eventType: 'narrator_fired',
      source: 'narrator',
      dedupeKey: `fired:${sessionId}`,
      payload: { blocker: request.blocker },
    });

    try {
      await pollAndDeliver(svc, agent, request, sessionId, recipient);
    } catch (pollErr) {
      console.error(`monitor_fire: poll/deliver failed for tx ${request.txId} session ${sessionId}:`, pollErr);
    }
    return true;
  } catch (err) {
    console.error(`monitor_fire: party ${party.userId} on tx ${request.txId} failed:`, err);
    return false;
  }
}

export interface MonitorFireResult {
  fired: number;
  /** Present only when the premium roster exceeded the per-invocation cap (additive field — the monorepo caller reads only `.fired`). */
  skipped?: number;
}

// Interim bound (review, 2026-08-29) on the trust-gap exposure documented at
// `resolveTransactionRoster` — NOT primarily a performance cap, though it
// also keeps worst-case concurrent runtime (POLL_ATTEMPTS x POLL_INTERVAL_MS
// plus network overhead) comfortably inside edge-function wall-clock limits.
const MAX_PREMIUM_PARTIES_PER_INVOCATION = 2;

/**
 * Resolve the roster, filter to premium, cap at
 * `MAX_PREMIUM_PARTIES_PER_INVOCATION`, and fire the rest CONCURRENTLY via
 * `Promise.allSettled` (`fireAndDeliverForParty` never rejects, so this is
 * purely a runtime bound, not an error-isolation mechanism — that isolation
 * already lives inside `fireAndDeliverForParty` itself). `fireParty` is
 * injectable so tests can verify the cap and the concurrency without
 * exercising the real network pipeline or waiting out real poll timers.
 */
export async function runMonitorFire(
  svc: SupabaseClient,
  agent: AgentConfig,
  request: MonitorFireAction,
  fireParty: (
    svc: SupabaseClient,
    agent: AgentConfig,
    request: MonitorFireAction,
    party: RosterParty,
  ) => Promise<boolean> = fireAndDeliverForParty,
): Promise<MonitorFireResult> {
  const roster = await resolveTransactionRoster(svc, request.txId);
  const premiumRoster = await filterPremiumRoster(svc, roster);

  const toFire = premiumRoster.slice(0, MAX_PREMIUM_PARTIES_PER_INVOCATION);
  const skipped = premiumRoster.length - toFire.length;

  const outcomes = await Promise.allSettled(toFire.map((party) => fireParty(svc, agent, request, party)));
  const fired = outcomes.filter((o) => o.status === 'fulfilled' && o.value === true).length;

  return skipped > 0 ? { fired, skipped } : { fired };
}
