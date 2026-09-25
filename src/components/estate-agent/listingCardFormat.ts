// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Shared formatting for the listing cards (row and tile) so both views
 * describe a listing identically.
 */

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export function formatListingPrice(price: number): string {
  return GBP_FORMATTER.format(price);
}

export function formatUpdatedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPublishedLine(publishedAt: string | null, updatedAt: string): string {
  return `${publishedAt ? 'Published' : 'Not published'} · Updated ${formatUpdatedDate(updatedAt)}`;
}
