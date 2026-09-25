/**
 * Unit tests for the monitor_fire roster resolution + premium-filtering seam
 * (chunk 2). No network — a fake SupabaseClient stands in for the
 * `transaction_party_roles` lookup. The full fire/poll/deliver pipeline
 * (fireNarration, getSessionStatus, deliverNarration) is thin `fetch`
 * wrappers, verified end-to-end against the live agent per this function's
 * existing testing convention — not unit tested here.
 * Run: deno test supabase/functions/move-narrator/monitor.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { filterPremiumRoster, isPremiumUser, resolveTransactionRoster, runMonitorFire } from './monitor.ts';
import type { AgentConfig, RosterParty } from './monitor.ts';
import type { MonitorFireAction } from './types.ts';

/** Records the `.order`/`.limit` args the roster query was built with, so tests can assert on them. */
interface RosterQuerySpy {
  orderCol?: string;
  orderOpts?: { ascending: boolean };
  limitArg?: number;
}

function fakeRosterClient(
  rows: Array<{ user_id: string; role: string }> | null,
  error: { message: string } | null = null,
  spy: RosterQuerySpy = {},
): SupabaseClient {
  const chain = {
    select: (_cols: string) => chain,
    eq: (_col: string, _val: string) => chain,
    in: (_col: string, _vals: string[]) => chain,
    order: (col: string, opts: { ascending: boolean }) => {
      spy.orderCol = col;
      spy.orderOpts = opts;
      return chain;
    },
    limit: (n: number) => {
      spy.limitArg = n;
      return Promise.resolve({ data: rows, error });
    },
  };
  return {
    from: (_table: string) => chain,
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

/** Mimics `.from('ai_scan_entitlements').select('user_id').eq('user_id', id).maybeSingle()`. */
function fakeEntitlementClient(
  row: { user_id: string } | null,
  error: { message: string } | null = null,
): SupabaseClient {
  const chain = {
    select: (_cols: string) => chain,
    eq: (_col: string, _val: string) => chain,
    maybeSingle: () => Promise.resolve({ data: row, error }),
  };
  return {
    from: (_table: string) => chain,
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

/**
 * A single fake client that answers correctly per-userId — needed to prove
 * a MIXED roster is filtered correctly in one `filterPremiumRoster` call
 * (one entitled party fires, one without a row doesn't).
 */
function fakeEntitlementClientFor(entitledUserIds: Set<string>): SupabaseClient {
  let queriedUserId = '';
  const chain = {
    select: (_cols: string) => chain,
    eq: (_col: string, val: string) => {
      queriedUserId = val;
      return chain;
    },
    maybeSingle: () =>
      Promise.resolve({
        data: entitledUserIds.has(queriedUserId) ? { user_id: queriedUserId } : null,
        error: null,
      }),
  };
  return {
    from: (_table: string) => chain,
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

Deno.test('resolveTransactionRoster maps rows to buyer/seller parties', async () => {
  const svc = fakeRosterClient([
    { user_id: 'u-buyer', role: 'buyer' },
    { user_id: 'u-seller', role: 'seller' },
  ]);
  const roster = await resolveTransactionRoster(svc, 'tx_1');
  assertEquals(roster, [
    { userId: 'u-buyer', role: 'buyer' },
    { userId: 'u-seller', role: 'seller' },
  ]);
});

Deno.test('resolveTransactionRoster bounds and orders the query (caps trust-gap amplification, card 3463e5cd)', async () => {
  const spy: RosterQuerySpy = {};
  const svc = fakeRosterClient([{ user_id: 'u-buyer', role: 'buyer' }], null, spy);
  await resolveTransactionRoster(svc, 'tx_1');
  assertEquals(spy.orderCol, 'created_at');
  assertEquals(spy.orderOpts, { ascending: true });
  assertEquals(spy.limitArg, 10);
});

Deno.test('resolveTransactionRoster returns an empty roster when the query errors (fail closed, never guesses)', async () => {
  const svc = fakeRosterClient(null, { message: 'db unavailable' });
  const roster = await resolveTransactionRoster(svc, 'tx_1');
  assertEquals(roster, []);
});

Deno.test('resolveTransactionRoster returns an empty roster when no party rows exist', async () => {
  const svc = fakeRosterClient([]);
  const roster = await resolveTransactionRoster(svc, 'tx_1');
  assertEquals(roster, []);
});

// --- isPremiumUser (ai_scan_entitlements proxy, controller ruling 2026-08-29) ---

Deno.test('isPremiumUser returns true when the user has an entitlement row', async () => {
  const svc = fakeEntitlementClient({ user_id: 'u-premium' });
  const result = await isPremiumUser(svc, 'u-premium');
  assertEquals(result, true);
});

Deno.test('isPremiumUser returns false when the user has no entitlement row (default DENY)', async () => {
  const svc = fakeEntitlementClient(null);
  const result = await isPremiumUser(svc, 'u-free');
  assertEquals(result, false);
});

Deno.test('isPremiumUser fails closed on a lookup error (never a free pass)', async () => {
  const svc = fakeEntitlementClient(null, { message: 'db unavailable' });
  const result = await isPremiumUser(svc, 'u-unknown');
  assertEquals(result, false);
});

Deno.test('filterPremiumRoster keeps only parties the injected premium check approves', async () => {
  const roster = [
    { userId: 'u-buyer', role: 'buyer' as const },
    { userId: 'u-seller', role: 'seller' as const },
  ];
  const premiumIds = new Set(['u-seller']);
  const fakeSvc = {} as unknown as SupabaseClient;
  const kept = await filterPremiumRoster(fakeSvc, roster, (_svc, userId) => Promise.resolve(premiumIds.has(userId)));
  assertEquals(kept, [{ userId: 'u-seller', role: 'seller' }]);
});

Deno.test('filterPremiumRoster returns everyone when the injected check always approves', async () => {
  const roster = [
    { userId: 'u-buyer', role: 'buyer' as const },
    { userId: 'u-seller', role: 'seller' as const },
  ];
  const fakeSvc = {} as unknown as SupabaseClient;
  const kept = await filterPremiumRoster(fakeSvc, roster, () => Promise.resolve(true));
  assertEquals(kept, roster);
});

Deno.test('filterPremiumRoster returns nobody when the injected check always denies (todays production default)', async () => {
  const roster = [{ userId: 'u-buyer', role: 'buyer' as const }];
  const fakeSvc = {} as unknown as SupabaseClient;
  const kept = await filterPremiumRoster(fakeSvc, roster, () => Promise.resolve(false));
  assertEquals(kept, []);
});

Deno.test('filterPremiumRoster defaults to isPremiumUser (ai_scan_entitlements) when no check is injected', async () => {
  const roster = [{ userId: 'u-free', role: 'buyer' as const }];
  const fakeSvc = fakeEntitlementClient(null);
  const kept = await filterPremiumRoster(fakeSvc, roster);
  assertEquals(kept, []);
});

Deno.test('filterPremiumRoster (via the real isPremiumUser): the entitled party fires, the one without a row does not', async () => {
  const roster = [
    { userId: 'u-premium', role: 'buyer' as const },
    { userId: 'u-free', role: 'seller' as const },
  ];
  const fakeSvc = fakeEntitlementClientFor(new Set(['u-premium']));
  const kept = await filterPremiumRoster(fakeSvc, roster);
  assertEquals(kept, [{ userId: 'u-premium', role: 'buyer' }]);
});

// --- runMonitorFire: 2-party cap + concurrency (review, 2026-08-29) --------
//
// `fireParty` is injected in every test below, so none of these touch the
// real network pipeline (fireNarration/getSessionStatus/deliverNarration)
// or wait out real poll timers — the injection point itself is what makes
// "fake timers not needed" true here.

/** Routes by table name: `transaction_party_roles` (roster) vs `ai_scan_entitlements` (premium). */
function fakeMonitorClient(rosterRows: Array<{ user_id: string; role: string }>, entitledUserIds: Set<string>): SupabaseClient {
  const rosterChain = {
    select: (_c: string) => rosterChain,
    eq: (_c: string, _v: string) => rosterChain,
    in: (_c: string, _v: string[]) => rosterChain,
    order: (_c: string, _o: { ascending: boolean }) => rosterChain,
    limit: (_n: number) => Promise.resolve({ data: rosterRows, error: null }),
  };
  let queriedUserId = '';
  const entitlementChain = {
    select: (_c: string) => entitlementChain,
    eq: (_c: string, v: string) => {
      queriedUserId = v;
      return entitlementChain;
    },
    maybeSingle: () =>
      Promise.resolve({ data: entitledUserIds.has(queriedUserId) ? { user_id: queriedUserId } : null, error: null }),
  };
  return {
    from: (table: string) => (table === 'transaction_party_roles' ? rosterChain : entitlementChain),
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

const FAKE_AGENT: AgentConfig = { apiKey: 'k', agentId: 'a', envId: 'e' };
const FAKE_MONITOR_REQUEST: MonitorFireAction = {
  action: 'monitor_fire',
  txId: 'tx_1',
  previousBlocker: 'no_solicitor',
  blocker: 'hmlr_not_fetched',
  urgency: 'soon',
};

Deno.test('runMonitorFire caps at 2 premium parties and reports the rest as skipped', async () => {
  const svc = fakeMonitorClient(
    [
      { user_id: 'u1', role: 'buyer' },
      { user_id: 'u2', role: 'seller' },
      { user_id: 'u3', role: 'buyer' },
    ],
    new Set(['u1', 'u2', 'u3']),
  );
  const calledFor: string[] = [];
  const fakeFireParty = (_svc: SupabaseClient, _agent: AgentConfig, _req: MonitorFireAction, party: RosterParty) => {
    calledFor.push(party.userId);
    return Promise.resolve(true);
  };
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, fakeFireParty);
  assertEquals(calledFor.length, 2);
  assertEquals(result, { fired: 2, skipped: 1 });
});

Deno.test('runMonitorFire omits skipped when the premium roster is within the cap', async () => {
  const svc = fakeMonitorClient([{ user_id: 'u1', role: 'buyer' }], new Set(['u1']));
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, () => Promise.resolve(true));
  assertEquals(result, { fired: 1 });
  assertEquals(Object.prototype.hasOwnProperty.call(result, 'skipped'), false);
});

Deno.test('runMonitorFire returns {fired: 0} with no skipped when nobody is premium', async () => {
  const svc = fakeMonitorClient([{ user_id: 'u1', role: 'buyer' }], new Set());
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, () => Promise.resolve(true));
  assertEquals(result, { fired: 0 });
});

Deno.test('runMonitorFire fires premium parties concurrently, not serially', async () => {
  const svc = fakeMonitorClient(
    [
      { user_id: 'u1', role: 'buyer' },
      { user_id: 'u2', role: 'seller' },
    ],
    new Set(['u1', 'u2']),
  );
  let inFlight = 0;
  let maxConcurrent = 0;
  const fakeFireParty = async () => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return true;
  };
  await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, fakeFireParty);
  // Serial execution could never exceed 1 in-flight call at a time; 2 proves
  // both were started before either finished.
  assertEquals(maxConcurrent, 2);
});

Deno.test('runMonitorFire still counts a fired party when a sibling fireParty call rejects (allSettled isolation)', async () => {
  const svc = fakeMonitorClient(
    [
      { user_id: 'u1', role: 'buyer' },
      { user_id: 'u2', role: 'seller' },
    ],
    new Set(['u1', 'u2']),
  );
  const fakeFireParty = (_svc: SupabaseClient, _agent: AgentConfig, _req: MonitorFireAction, party: RosterParty) => {
    if (party.userId === 'u1') return Promise.reject(new Error('boom'));
    return Promise.resolve(true);
  };
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, fakeFireParty);
  assertEquals(result.fired, 1);
});
