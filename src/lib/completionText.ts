// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { CompletionSide, CompletionStatus, SideConfirmation } from '@/services/completionStatus';

/** Shown instead of hashing a zero price or a blank address. */
export const MISSING_DEAL_FACTS_TEXT = 'The agreed price or address is missing — ask your conveyancer or support.';

function formatDate(at: Date): string {
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** How a side's completion money was confirmed, in plain words. */
export function sideConfirmationText(side: CompletionSide, confirmation: SideConfirmation | null): string {
  if (!confirmation) return 'Not yet confirmed';
  const date = formatDate(confirmation.at);
  return confirmation.byConveyancer
    ? `Confirmed by the ${side}'s conveyancer on ${date}`
    : `Client-confirmed, not verified by a conveyancer, on ${date}`;
}

/** Who confirmed keys released, in plain words. */
export function keysReleasedText(keys: CompletionStatus['keysReleased']): string {
  if (!keys) return 'Not yet confirmed';
  const who = keys.byAgent ? "the seller's agent" : 'the seller';
  return `Confirmed by ${who} on ${formatDate(keys.at)}`;
}
