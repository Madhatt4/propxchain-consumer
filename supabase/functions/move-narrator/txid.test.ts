/**
 * Unit tests for verifiedTxId (chunk 2 precondition #1: server-side txId
 * verification on status/deliver). No network — a fake SupabaseClient stands
 * in for the `transaction_telemetry` lookup.
 * Run: deno test supabase/functions/move-narrator/txid.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { verifiedTxId } from './txid.ts';

// deno-lint-ignore no-explicit-any
function fakeTelemetryClient(row: { transaction_id: string } | null, error: { message: string } | null = null): SupabaseClient {
  const chain = {
    select: (_cols: string) => chain,
    eq: (_col: string, _val: string) => chain,
    limit: (_n: number) => chain,
    maybeSingle: () => Promise.resolve({ data: row, error }),
  };
  return {
    from: (_table: string) => chain,
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

Deno.test('verifiedTxId prefers the recorded value when it disagrees with the client', async () => {
  const svc = fakeTelemetryClient({ transaction_id: 'tx_real' });
  const result = await verifiedTxId(svc, 'sesn_1', 'tx_spoofed');
  assertEquals(result, 'tx_real');
});

Deno.test('verifiedTxId prefers the recorded value even when the client omitted txId', async () => {
  const svc = fakeTelemetryClient({ transaction_id: 'tx_real' });
  const result = await verifiedTxId(svc, 'sesn_1', undefined);
  assertEquals(result, 'tx_real');
});

Deno.test('verifiedTxId falls back to the client value when no row exists (pre-telemetry session)', async () => {
  const svc = fakeTelemetryClient(null);
  const result = await verifiedTxId(svc, 'sesn_1', 'tx_client');
  assertEquals(result, 'tx_client');
});

Deno.test('verifiedTxId returns undefined when no row exists and the client omitted txId', async () => {
  const svc = fakeTelemetryClient(null);
  const result = await verifiedTxId(svc, 'sesn_1', undefined);
  assertEquals(result, undefined);
});

Deno.test('verifiedTxId falls back to the client value on a lookup error (non-security-critical attribution)', async () => {
  const svc = fakeTelemetryClient(null, { message: 'db unavailable' });
  const result = await verifiedTxId(svc, 'sesn_1', 'tx_client');
  assertEquals(result, 'tx_client');
});
