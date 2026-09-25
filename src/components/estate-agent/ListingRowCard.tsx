// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Compact one-line-per-listing card for the estate agent's list view.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { AgentListingRow } from '@/types/estateAgentListing.types';
import { ListingStatusBadge } from './ListingStatusBadge';
import { formatListingPrice, formatPublishedLine } from './listingCardFormat';

export function ListingRowCard({ row }: { row: AgentListingRow }): JSX.Element {
  // See TileHero: `images` may be absent entirely, not merely empty.
  const thumbnailUrl = row.listing.images?.[0]?.url;
  const [hasThumbnailFailed, setHasThumbnailFailed] = useState<boolean>(false);
  return (
    <li>
      <Link
        to={`/estate-agent/listings/${row.id}`}
        className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-[#0D9488]/40 hover:bg-[#0D9488]/5 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-[#0D9488]/40 dark:hover:bg-[#0D9488]/5"
      >
        {thumbnailUrl && !hasThumbnailFailed ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
            onError={() => setHasThumbnailFailed(true)}
          />
        ) : (
          <div className="h-16 w-16 flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-[Fraunces] text-base font-semibold text-gray-900 dark:text-gray-50">
            {row.listing.address}
          </p>
          <p className="mt-1 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
            {formatListingPrice(row.listing.price)} · {row.listing.bedrooms} bed
          </p>
          <p className="mt-1 font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">
            {formatPublishedLine(row.published_at, row.updated_at)}
          </p>
        </div>
        <ListingStatusBadge status={row.status} />
      </Link>
    </li>
  );
}
