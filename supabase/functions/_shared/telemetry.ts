// supabase/functions/_shared/telemetry.ts
//
// Verbatim copy of the monorepo's Task 2 helper
// (Propxchain/supabase/functions/_shared/telemetry.ts) — two repos deploy edge
// functions to the SAME Supabase project, so `transaction_telemetry` and
// `telemetry_watchlist` are shared tables. Keep this file in sync with the
// monorepo copy; do not diverge the event contract.
//
// The SupabaseClient import below is pinned to @2.45.0 (not the monorepo's
// unpinned @2) to match this repo's move-narrator/index.ts convention — the
// caller passes a client typed against that exact esm.sh build, and mixing
// pinned/unpinned @2 specifiers here already causes a structural type
// mismatch elsewhere in this repo (_shared/rate-limit.ts, pre-existing).
//
// Fire-and-forget telemetry emitter for the agentic layer (chunk 1).
// HARD RULE (GDPR): payload must contain only counts, enum keys, and
// timestamps — never principals, names, emails, findings text, or any
// user-authored free text. The chain / scan tables hold the detail.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const EVENT_TYPES = [
  'chain_event',
  'blocker_changed',
  'scan_completed',
  'quote_requested',
  'quote_accepted',
  'narrator_fired',
  'narrator_verdict',
  'narrator_delivered',
  'monitor_nudge_sent',
  'monitor_escalated',
] as const;
export type TelemetryEventType = (typeof EVENT_TYPES)[number];

export interface TelemetryEvent {
  transactionId: string;
  eventType: TelemetryEventType;
  source: 'chain_sync' | 'edge_fn' | 'narrator' | 'monitor';
  chainEventType?: string;
  dedupeKey?: string;
  payload?: Record<string, unknown>;
  /** ISO timestamp; defaults to now(). Chain sync passes the on-chain time. */
  occurredAt?: string;
}

export async function emitTelemetry(
  svc: SupabaseClient,
  ev: TelemetryEvent,
): Promise<void> {
  try {
    const { error } = await svc.from('transaction_telemetry').insert({
      transaction_id: ev.transactionId,
      event_type: ev.eventType,
      source: ev.source,
      chain_event_type: ev.chainEventType ?? null,
      dedupe_key: ev.dedupeKey ?? null,
      payload: ev.payload ?? {},
      occurred_at: ev.occurredAt ?? new Date().toISOString(),
    });
    if (error && !error.message?.includes('duplicate')) {
      console.error('telemetry insert failed', ev.eventType, error.message);
    }
    const { error: wlError } = await svc.from('telemetry_watchlist').upsert(
      { transaction_id: ev.transactionId, added_from: ev.source },
      { onConflict: 'transaction_id', ignoreDuplicates: true },
    );
    if (wlError) console.error('telemetry watchlist upsert failed', wlError.message);
  } catch (e) {
    // Never let telemetry break the parent request.
    console.error('telemetry emit crashed', (e as Error).message);
  }
}
