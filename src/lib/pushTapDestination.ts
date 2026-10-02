// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Transaction ids are short slugs; anything else in a notification is ignored. */
const TX_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Where a tapped notification should open, or null if its data is not usable. */
export function pushTapDestination(data: Record<string, unknown>): string | null {
  const txId = data.txId;
  if (typeof txId === 'string' && TX_ID.test(txId)) return `/transaction/${txId}/flow`;
  return null;
}
