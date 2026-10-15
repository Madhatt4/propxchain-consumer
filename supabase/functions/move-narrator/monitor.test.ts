/**
 * Unit tests for the monitor_fire roster resolution + firing seam
 * (chunk 2). No network — a fake SupabaseClient stands in for the
 * `transaction_party_roles` lookup. The full fire/poll/deliver pipeline
 * (fireNarration, getSessionStatus, deliverNarration) is thin `fetch`
 * wrappers, verified end-to-end against the live agent per this function's
 * existing testing convention — not unit tested here.
 * Run: deno test supabase/functions/move-narrator/monitor.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { resolveTransactionRoster, runMonitorFire } from './monitor.ts';
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

// --- runMonitorFire: 2-party cap + concurrency (review, 2026-08-29) --------
//
// `fireParty` is injected in every test below, so none of these touch the
// real network pipeline (fireNarration/getSessionStatus/deliverNarration)
// or wait out real poll timers — the injection point itself is what makes
// "fake timers not needed" true here.

/** Serves the roster and records every table queried, so tests can prove no tier lookup happens. */
function fakeMonitorClient(
  rosterRows: Array<{ user_id: string; role: string }>,
  tablesQueried: string[] = [],
): SupabaseClient {
  const rosterChain = {
    select: (_c: string) => rosterChain,
    eq: (_c: string, _v: string) => rosterChain,
    in: (_c: string, _v: string[]) => rosterChain,
    order: (_c: string, _o: { ascending: boolean }) => rosterChain,
    limit: (_n: number) => Promise.resolve({ data: rosterRows, error: null }),
  };
  return {
    from: (table: string) => {
      tablesQueried.push(table);
      return rosterChain;
    },
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

Deno.test('runMonitorFire caps at 2 parties and reports the rest as skipped', async () => {
  const svc = fakeMonitorClient(
    [
      { user_id: 'u1', role: 'buyer' },
      { user_id: 'u2', role: 'seller' },
      { user_id: 'u3', role: 'buyer' },
    ],
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

Deno.test('runMonitorFire omits skipped when the roster is within the cap', async () => {
  const svc = fakeMonitorClient([{ user_id: 'u1', role: 'buyer' }]);
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, () => Promise.resolve(true));
  assertEquals(result, { fired: 1 });
  assertEquals(Object.prototype.hasOwnProperty.call(result, 'skipped'), false);
});

Deno.test('runMonitorFire returns {fired: 0} with no skipped when the roster is empty', async () => {
  const svc = fakeMonitorClient([]);
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, () => Promise.resolve(true));
  assertEquals(result, { fired: 0 });
});

Deno.test('runMonitorFire fires every roster party with no tier lookup (Narrator is on for everyone)', async () => {
  const tablesQueried: string[] = [];
  const svc = fakeMonitorClient(
    [
      { user_id: 'u1', role: 'buyer' },
      { user_id: 'u2', role: 'seller' },
    ],
    tablesQueried,
  );
  const calledFor: string[] = [];
  const fakeFireParty = (_svc: SupabaseClient, _agent: AgentConfig, _req: MonitorFireAction, party: RosterParty) => {
    calledFor.push(party.userId);
    return Promise.resolve(true);
  };
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, fakeFireParty);
  assertEquals(result, { fired: 2 });
  assertEquals(calledFor, ['u1', 'u2']);
  assertEquals(tablesQueried, ['transaction_party_roles']);
});

Deno.test('runMonitorFire fires parties concurrently, not serially', async () => {
  const svc = fakeMonitorClient(
    [
      { user_id: 'u1', role: 'buyer' },
      { user_id: 'u2', role: 'seller' },
    ],
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
  );
  const fakeFireParty = (_svc: SupabaseClient, _agent: AgentConfig, _req: MonitorFireAction, party: RosterParty) => {
    if (party.userId === 'u1') return Promise.reject(new Error('boom'));
    return Promise.resolve(true);
  };
  const result = await runMonitorFire(svc, FAKE_AGENT, FAKE_MONITOR_REQUEST, fakeFireParty);
  assertEquals(result.fired, 1);
});
