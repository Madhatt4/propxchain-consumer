/**
 * Server-side txId verification for `status`/`deliver` (chunk 2 precondition
 * #1 from the transaction-monitor plan). `request.txId` on those two actions
 * was client-supplied and unverified, so a caller could attribute the
 * `narrator_verdict` / `narrator_delivered` telemetry rows to a transaction
 * they do not belong to. The `narrator_fired` row recorded at `fire` time is
 * the authoritative source — this looks it up by the deterministic dedupe
 * key and prefers it over any client-supplied value whenever a row exists,
 * even if the client omitted txId entirely.
 *
 * Pre-telemetry sessions (fired before chunk 1 shipped, or a lookup error)
 * have no such row — falling back to the client value there is a low-stakes
 * choice (it only affects which transaction an audit-log row is attributed
 * to, never access control), the same trade-off `emitTelemetry` itself makes
 * for its own failures.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export async function verifiedTxId(
  svc: SupabaseClient,
  sessionId: string,
  clientTxId: string | undefined,
): Promise<string | undefined> {
  const { data, error } = await svc
    .from('transaction_telemetry')
    .select('transaction_id')
    .eq('event_type', 'narrator_fired')
    .eq('dedupe_key', `fired:${sessionId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('verifiedTxId lookup failed; falling back to client value:', error.message);
    return clientTxId;
  }

  const recorded = (data as { transaction_id?: string } | null)?.transaction_id;
  return typeof recorded === 'string' && recorded ? recorded : clientTxId;
}
