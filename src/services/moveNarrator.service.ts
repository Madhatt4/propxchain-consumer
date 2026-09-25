/**
 * Move Narrator — client wrapper for the `move-narrator` Supabase edge function.
 *
 * The edge function is the only place `ANTHROPIC_API_KEY` and the delivery
 * provider keys live, so the client never composes message text and never sees
 * those secrets. This module is a thin, typed wrapper over the three actions:
 *
 *   fire    → start a graded run when a transaction's blocker changes
 *   status  → poll the run until it finishes
 *   deliver → send email/SMS (server-side, when configured) and return the
 *             in-app notification for the client to render
 *
 * See `supabase/functions/move-narrator/index.ts` for the contract.
 */

import { supabase } from '../lib/supabase';
import type { NextStepRecommendation } from './next-step.service';

const FUNCTION_NAME = 'move-narrator';

export interface MoveNarratorTransaction {
  txId: string;
  /** Absolute URL of the transaction dashboard, used as the notification link. */
  url: string;
  role: 'buyer' | 'seller';
  propertyAddress: string;
  /** The blocker BEFORE this change, so the narrator can say what progressed. */
  previousBlocker: string;
}

/**
 * Delivery goes to the signed-in user's own registered email/phone, resolved
 * server-side from the session. The client cannot choose a destination — see
 * `supabase/functions/move-narrator/index.ts`.
 */

export interface InAppNotification {
  title: string;
  body: string;
  txUrl: string;
  urgency: string;
}

export interface ChannelResult {
  channel: 'in_app' | 'email' | 'sms';
  status: 'sent' | 'skipped' | 'error' | 'returned_to_client';
  detail?: string;
}

export interface NarrationStatus {
  status: string;
  verdict: string | null;
}

/**
 * Whether a run has genuinely finished. `status === 'idle'` alone is NOT
 * enough: the run starts asynchronously after `fire`, so a just-fired session
 * reports `idle` (verdict `pending`) for a few seconds before it flips to
 * `running`. Delivering on that first idle races the agent and yields no card.
 * A finished run is idle with a terminal grader verdict (e.g. `satisfied`).
 */
export function isNarrationSettled(status: string, verdict: string | null): boolean {
  return status === 'idle' && verdict !== null && verdict !== 'pending';
}

export interface DeliverResult {
  notification: InAppNotification | null;
  results: ChannelResult[];
}

/**
 * Invoke one action on the edge function and unwrap the response.
 *
 * `supabase.functions.invoke` surfaces transport/HTTP failures via `error`;
 * the function itself also returns `{ error }` in its body for 4xx/5xx. Both
 * are normalised to a thrown Error so callers handle a single failure path.
 */
async function invokeAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });

  if (error) {
    // Supabase surfaces a FunctionsError (or a plain object) carrying `.message`.
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
    throw new Error(`move-narrator ${String(body.action)} failed: ${message}`);
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`move-narrator ${String(body.action)} failed: ${String((data as { error: unknown }).error)}`);
  }

  return data as T;
}

/** Start a graded run for a transaction whose blocker just changed. */
export async function fireNarration(
  transaction: MoveNarratorTransaction,
  getNextStep: NextStepRecommendation,
): Promise<string> {
  const { sessionId } = await invokeAction<{ sessionId: string }>({
    action: 'fire',
    transaction,
    getNextStep,
  });
  return sessionId;
}

/**
 * Poll a run's status + grader verdict (so the client can wait without the key).
 *
 * `txId` is optional and telemetry-only — it lets the server attribute the
 * `narrator_verdict` event once the run settles. Omitting it only skips that
 * one server-side telemetry emit; polling behaviour is unchanged.
 */
export async function getNarrationStatus(sessionId: string, txId?: string): Promise<NarrationStatus> {
  return invokeAction<NarrationStatus>({ action: 'status', sessionId, ...(txId ? { txId } : {}) });
}

/**
 * Fetch + send the run's outputs. Email/SMS go out server-side when configured,
 * addressed to the authenticated user's own contact details; the in-app
 * notification always comes back for the client to render.
 *
 * `txId` is optional and telemetry-only, same as `getNarrationStatus` — never
 * a delivery address, which stays server-derived (see index.ts).
 */
export async function deliverNarration(sessionId: string, txId?: string): Promise<DeliverResult> {
  return invokeAction<DeliverResult>({ action: 'deliver', sessionId, ...(txId ? { txId } : {}) });
}
