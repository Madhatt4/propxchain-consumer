// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import type { DealSide } from '@/services/shareParty.service';

/** "the seller", "the buyer", or "the seller and the buyer" once the agency acts for both. */
export function sidesPhrase(sides: readonly DealSide[]): string {
  const ordered = (['seller', 'buyer'] as const).filter((s) => sides.includes(s));
  return ordered.map((s) => `the ${s}`).join(' and ');
}
