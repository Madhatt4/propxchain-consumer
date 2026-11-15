// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The Title register row's action: the same £7 HM Land Registry pull Stage 1
 * offers (HMLRTitlePullButton — same Stripe checkout, pending-state resume,
 * refund-on-failure and "view existing" path), started from the pack in one
 * click. Without a title number there is nothing to pull, so the row sends
 * the seller to Stage 1 to add one.
 */
import { useCallback } from 'react';
import { useRefreshPackReadiness } from '@/hooks/usePackReadiness';
import { getPendingTitlePull } from '@/services/hmlrPullPending';
import HMLRTitlePullButton from '../HMLRTitlePullButton';
import { LIST_PROPERTY_STAGE_ID, PACK_ACTION_CLASS } from './salesPackStages';

interface TitlePullActionProps {
  transactionId: string;
  titleNumber?: string;
  onGoToStage?: (stageId: string) => void;
  /** Lets the row keep this mounted after the pull ticks it, so the register modal stays open. */
  onPulled: () => void;
}

export function TitlePullAction({
  transactionId,
  titleNumber,
  onGoToStage,
  onPulled,
}: TitlePullActionProps): JSX.Element | null {
  const refreshReadiness = useRefreshPackReadiness(transactionId);
  const handlePulled = useCallback(() => {
    onPulled();
    refreshReadiness();
  }, [onPulled, refreshReadiness]);
  // A paid pull waiting on this device carries the title it was bought for.
  const pullTitle = titleNumber ?? getPendingTitlePull(transactionId)?.titleNumber;

  if (!pullTitle) {
    if (!onGoToStage) return null;
    return (
      <button type="button" className={PACK_ACTION_CLASS} onClick={() => onGoToStage(LIST_PROPERTY_STAGE_ID)}>
        Add title number in Stage 1<span aria-hidden="true"> &rsaquo;</span>
      </button>
    );
  }
  return (
    <HMLRTitlePullButton
      variant="compact"
      titleNumber={pullTitle}
      transactionId={transactionId}
      onSuccess={handlePulled}
    />
  );
}
