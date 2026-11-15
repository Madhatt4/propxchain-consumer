// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Back from paying for a title pull with Stage 1 already done, the only pull
 * button on the page is the Sales pack row's (Stage 1 shows a summary), so
 * open the pack once and let that button resume the pull. One-shot per
 * mount: after it fires the seller navigates freely, and once the pull lands
 * the pending entry is gone anyway.
 */
import { useEffect, useRef } from 'react';
import { hasPendingTitlePull } from '@/services/hmlrPullPending';

export interface TitlePullResumeRedirectInput {
  transactionId: string | undefined;
  /** Seller journey with Stage 1 completed — the stages have loaded. */
  isSellerWithStage1Done: boolean;
  /** The user has already picked a stage; never override that. */
  hasChosenStage: boolean;
  openSalesPack: () => void;
}

export function useTitlePullResumeRedirect({
  transactionId,
  isSellerWithStage1Done,
  hasChosenStage,
  openSalesPack,
}: TitlePullResumeRedirectInput): void {
  const hasFired = useRef(false);
  useEffect(() => {
    if (hasFired.current || hasChosenStage || !isSellerWithStage1Done) return;
    hasFired.current = true;
    if (hasPendingTitlePull(transactionId)) openSalesPack();
  }, [transactionId, isSellerWithStage1Done, hasChosenStage, openSalesPack]);
}
