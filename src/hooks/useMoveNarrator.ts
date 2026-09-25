/**
 * useMoveNarrator — detects a transaction's blocker change and drives the
 * server-side Move Narrator run for premium customers.
 *
 * Mounted wherever a transaction is open (the flow page). On each check it:
 *   1. reads the authoritative `getNextStep` blocker (same call the card makes),
 *   2. compares it to the last blocker recorded for this tx,
 *   3. for a premium user with a genuine change, fires a graded run, polls it
 *      to completion, delivers it, and records the returned in-app card.
 *
 * Idempotency: the recorded blocker is updated synchronously the moment we
 * decide to fire, and an in-memory guard blocks concurrent fires for the same
 * (tx, blocker) — so a re-render or refetch never fires twice for one change.
 *
 * All message composition stays server-side; this hook only forwards state and
 * records the card the server hands back.
 */

import { useEffect } from 'react';

import { useSubscription } from './useSubscription';
import { getNextStep } from '../services/next-step.service';
import {
  evaluateTrigger,
  readLastBlocker,
  writeLastBlocker,
} from '../services/moveNarrator.detection';
import {
  deliverNarration,
  fireNarration,
  getNarrationStatus,
  isNarrationSettled,
  type MoveNarratorTransaction,
} from '../services/moveNarrator.service';
import { appendNotification } from '../services/moveNarratorNotifications';
import type { NextStepRecommendation } from '../services/next-step.service';
import { logger } from '@/utils/logger';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 36; // ~6 minute ceiling — runs commonly take 1–3 min, sometimes more

/** (tx, blocker) pairs currently mid-fire — guards against concurrent runs. */
const firing = new Set<string>();

export interface UseMoveNarratorParams {
  txId: string;
  role: 'buyer' | 'seller';
  propertyAddress: string;
  /** Bump to re-check after on-chain edits land (mirrors NextStepCard.refreshKey). */
  refreshKey?: number | string;
}

export function useMoveNarrator({
  txId,
  role,
  propertyAddress,
  refreshKey,
}: UseMoveNarratorParams): void {
  const { isPremium, isLoading } = useSubscription();

  useEffect(() => {
    if (!txId || isLoading) return;
    let cancelled = false;

    void (async () => {
      const result = await getNextStep(txId);
      if (cancelled || 'err' in result) return;

      const currentBlocker = result.ok.blocker;
      const previousBlocker = readLastBlocker(txId);
      const decision = evaluateTrigger({ currentBlocker, lastBlocker: previousBlocker, isPremium });

      if (decision === 'noop') return;

      // Record the new blocker before anything async so re-renders dedup.
      writeLastBlocker(txId, currentBlocker);
      if (decision === 'update_only') return;

      const guardKey = `${txId}:${currentBlocker}`;
      if (firing.has(guardKey)) return;
      firing.add(guardKey);

      try {
        await runNarration({
          txId,
          role,
          propertyAddress,
          previousBlocker: previousBlocker ?? '',
          recommendation: result.ok,
          isCancelled: () => cancelled,
        });
      } catch (err) {
        logger.warn('[moveNarrator] run failed', err);
      } finally {
        firing.delete(guardKey);
      }
    })();

    return () => {
      cancelled = true;
    };
    // role/propertyAddress are stable for a given tx; intentionally keyed on the
    // detection inputs so a change or edit re-checks exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId, refreshKey, isPremium, isLoading]);
}

interface RunNarrationArgs {
  txId: string;
  role: 'buyer' | 'seller';
  propertyAddress: string;
  previousBlocker: string;
  recommendation: NextStepRecommendation;
  isCancelled: () => boolean;
}

/** Fire → poll → deliver → record the in-app card for one blocker change. */
async function runNarration(args: RunNarrationArgs): Promise<void> {
  const transaction: MoveNarratorTransaction = {
    txId: args.txId,
    url: dashboardUrl(args.txId),
    role: args.role,
    propertyAddress: args.propertyAddress,
    previousBlocker: args.previousBlocker,
  };

  const sessionId = await fireNarration(transaction, args.recommendation);

  const settled = await pollUntilIdle(sessionId, args.txId, args.isCancelled);
  if (!settled || args.isCancelled()) return;

  // The edge function addresses email/SMS to the signed-in user's own contact
  // details, resolved from the session. Nothing to pass and nothing to choose.
  const { notification } = await deliverNarration(sessionId, args.txId);
  if (args.isCancelled() || !notification) return;

  appendNotification({
    txId: args.txId,
    title: notification.title,
    body: notification.body,
    txUrl: notification.txUrl,
    urgency: notification.urgency,
  });
}

/** Poll the run until it settles (idle + graded), capped. Returns whether it settled. */
async function pollUntilIdle(sessionId: string, txId: string, isCancelled: () => boolean): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    if (isCancelled()) return false;
    const { status, verdict } = await getNarrationStatus(sessionId, txId);
    if (isNarrationSettled(status, verdict)) return true;
    await delay(POLL_INTERVAL_MS);
  }
  return false;
}

function dashboardUrl(txId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/transaction/${txId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
