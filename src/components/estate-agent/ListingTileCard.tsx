// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Photo-first tile for the estate agent's grid view: hero image with the
 * status badge overlaid, then the key facts underneath.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { AgentListingRow } from '@/types/estateAgentListing.types';
import { ListingStatusBadge } from './ListingStatusBadge';
import { formatListingPrice, formatPublishedLine } from './listingCardFormat';

function TileHero({ row }: { row: AgentListingRow }): JSX.Element {
  // `images` can be absent, not just empty: rows saved before the worker
  // started emitting the key omit it for a listing with no photos, and
  // indexing an undefined array throws in render.
  const heroUrl = row.listing.images?.[0]?.url;
  const [hasHeroFailed, setHasHeroFailed] = useState<boolean>(false);
  if (heroUrl && !hasHeroFailed) {
    return (
      <img
        src={heroUrl}
        alt={row.listing.address}
        className="aspect-[4/3] w-full object-cover"
        onError={() => setHasHeroFailed(true)}
      />
    );
  }
  return (
    <div
      data-testid={`listing-tile-placeholder-${row.id}`}
      className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 font-[DM_Sans] text-xs text-gray-400 dark:bg-gray-700 dark:text-gray-500"
    >
      No photo yet
    </div>
  );
}

export function ListingTileCard({ row }: { row: AgentListingRow }): JSX.Element {
  return (
    <li>
      <Link
        to={`/estate-agent/listings/${row.id}`}
        className="block overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-[#0D9488]/40 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-[#0D9488]/40"
      >
        <div className="relative">
          <TileHero row={row} />
          <div className="absolute left-2 top-2">
            <ListingStatusBadge status={row.status} />
          </div>
        </div>
        <div className="p-4">
          <p className="truncate font-[Fraunces] text-base font-semibold text-gray-900 dark:text-gray-50">
            {row.listing.address}
          </p>
          <p className="mt-1 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
            {formatListingPrice(row.listing.price)} · {row.listing.bedrooms} bed · {row.listing.propertyType}
          </p>
          <p className="mt-1 font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">
            {formatPublishedLine(row.published_at, row.updated_at)}
          </p>
        </div>
      </Link>
    </li>
  );
}
