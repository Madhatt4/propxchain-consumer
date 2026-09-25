// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One live sale on the agent's chase list: the property, the price, who the
 * deal is waiting on and for how long (roles only), and the listing status.
 * Opens the listing, where the parties and the same wait line live.
 */
import { Link } from 'react-router-dom';
import { CalendarClock, Check, Hourglass, Loader2 } from 'lucide-react';

import { describeStall } from '@/services/stall.service';
import { formatDueDate } from './chaseLogFormat';
import { ListingStatusBadge } from './ListingStatusBadge';
import type { ChaseEntry } from './chaseList';
import { formatListingPrice } from './listingCardFormat';

interface ChaseRowCardProps {
  entry: ChaseEntry;
  /** The stalls have not loaded yet: say so rather than "Nothing waiting". */
  isPending?: boolean;
}

function waitLine(wait: ChaseEntry['wait'], isPending: boolean): { icon: JSX.Element; text: string; tone: string } {
  if (isPending) {
    return { icon: <Loader2 size={14} className="animate-spin" aria-hidden />, text: 'Checking who it is waiting on…', tone: 'text-gray-400 dark:text-gray-500' };
  }
  if (wait) return { icon: <Hourglass size={14} aria-hidden />, text: describeStall(wait), tone: 'text-[#9A3412] dark:text-[#FDBA74]' };
  return { icon: <Check size={14} aria-hidden />, text: 'Nothing waiting', tone: 'text-gray-500 dark:text-gray-400' };
}

export function ChaseRowCard({ entry, isPending = false }: ChaseRowCardProps): JSX.Element {
  const { row, wait } = entry;
  const line = waitLine(wait, isPending);
  return (
    <li>
      <Link
        to={`/estate-agent/listings/${row.id}`}
        data-testid="chase-row"
        data-days={isPending ? '' : (wait?.days ?? '')}
        data-pending={isPending ? 'true' : undefined}
        className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-[#0D9488]/40 hover:bg-[#0D9488]/5 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-[#0D9488]/40 dark:hover:bg-[#0D9488]/5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-[Fraunces] text-base font-semibold text-gray-900 dark:text-gray-50">
            {row.listing.address}
          </p>
          <p className="mt-1 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
            {formatListingPrice(row.listing.price)}
          </p>
          <p className={`mt-2 flex items-center gap-2 font-[DM_Sans] text-sm ${line.tone}`}>
            {line.icon}
            <span>{line.text}</span>
          </p>
          {entry.nextDue && (
            <p
              data-testid="chase-next-due"
              className={`mt-1 flex items-center gap-2 font-[DM_Sans] text-xs ${entry.overdueDays > 0 ? 'text-[#9A3412] dark:text-[#FDBA74]' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <CalendarClock size={14} aria-hidden />
              <span>{entry.overdueDays > 0 ? `Next action overdue by ${entry.overdueDays} day${entry.overdueDays === 1 ? '' : 's'}` : `Next action due ${formatDueDate(entry.nextDue)}`}</span>
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {entry.actingFor.map((side) => (
            <span
              key={side}
              data-testid="chase-acting-for"
              className="rounded-full border border-[#0D9488]/30 bg-[#CCFBF1]/30 px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[#0F766E]"
            >
              Acting for the {side}
            </span>
          ))}
          <ListingStatusBadge status={row.status} />
        </div>
      </Link>
    </li>
  );
}
