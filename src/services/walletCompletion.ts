// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * walletCompletion — the completion lifecycle for a deal's shared documents
 * (wallet spec 2026-08-18, decision 8). Once completion has been initiated
 * on-chain, every share in the deal gets an expiry of completion + 14 days;
 * RLS denies reads after that, and this helper erases + logs the revoke the
 * next time the owner opens the deal (there is no server-side scheduler).
 * Called from the owner's Transaction Wallet on load; scheduling also runs at
 * the moment completion is initiated.
 */
import { icpService } from './icp.service';
import { documentShareService } from './documentShare.service';
import { statusIsCompleted } from './phase';
import { logger } from '@/utils/logger';

export interface CompletionLifecycle {
  /** Completion initiated or done on-chain. */
  isCompleted: boolean;
  /** ISO expiry applied to this deal's shares (earliest active), null when none. */
  accessEndsAt: string | null;
  /** Grants revoked (erased) on this pass because their expiry had passed. */
  expiredNow: number;
}

type StatusLike = Record<string, null> | null | undefined;

/** Completion counts from the moment it is initiated on-chain. */
export function statusIsCompletionStarted(status: StatusLike): boolean {
  if (!status) return false;
  return 'completion_initiated' in status || statusIsCompleted(status as Parameters<typeof statusIsCompleted>[0]);
}

export async function applyCompletionLifecycle(transactionId: string): Promise<CompletionLifecycle> {
  let isCompleted = false;
  try {
    const tx = (await icpService.getTransaction(transactionId)) as { status?: StatusLike } | null;
    isCompleted = statusIsCompletionStarted(tx?.status);
  } catch (err) {
    logger.warn('[walletCompletion] status lookup failed', err);
  }

  let accessEndsAt: string | null = null;
  if (isCompleted) {
    try {
      accessEndsAt = await documentShareService.scheduleExpiryForDeal(transactionId);
    } catch (err) {
      logger.warn('[walletCompletion] could not schedule expiry', err);
    }
  }

  let expiredNow = 0;
  try {
    expiredNow = await documentShareService.expireOverdue(transactionId);
  } catch (err) {
    logger.warn('[walletCompletion] expiry sweep failed', err);
  }

  return { isCompleted, accessEndsAt, expiredNow };
}
