// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One line, for everyone on the deal, once the searches are four months old
 * (services/searchAge.ts). Silent while they're fresh or not yet ordered.
 */
import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { icpService } from '@/services/icp.service';
import { describeSearchAge, searchAgeFromEvents, type SearchAge } from '@/services/searchAge';
import { logger } from '@/utils/logger';

interface SearchAgeLineProps {
  transactionId: string;
  refreshKey?: number | string;
  className?: string;
  /** Test seam: skip the ledger read. */
  ageOverride?: SearchAge | null;
}

export function SearchAgeLine({ transactionId, refreshKey, className = '', ageOverride }: SearchAgeLineProps): JSX.Element | null {
  const [age, setAge] = useState<SearchAge | null>(ageOverride ?? null);

  useEffect(() => {
    if (ageOverride !== undefined) return;
    let active = true;
    setAge(null);
    void (async () => {
      try {
        const raw = await icpService.ledgerManager?.getEventsByTransaction(transactionId);
        const events = Array.isArray(raw)
          ? raw.map((e: { eventType?: unknown; timestamp?: unknown }) => ({
              eventType: String(e.eventType ?? ''),
              timestamp: Number(e.timestamp ?? 0),
            }))
          : [];
        if (active) setAge(searchAgeFromEvents(events, Date.now()));
      } catch (error) {
        logger.warn('Search age unavailable', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [transactionId, refreshKey, ageOverride]);

  if (!age || age.state === 'ok') return null;
  const expired = age.state === 'expired';
  return (
    <p
      data-testid="search-age-line"
      data-state={age.state}
      role={expired ? 'alert' : undefined}
      className={`flex items-start gap-2 font-sans text-sm ${expired ? 'text-red-700 dark:text-red-400' : 'text-stone-700 dark:text-slate-300'} ${className}`}
    >
      <CalendarClock
        className={`mt-0.5 h-4 w-4 shrink-0 ${expired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}
        aria-hidden
      />
      <span>{describeSearchAge(age)}</span>
    </p>
  );
}
