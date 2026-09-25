// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The stall line: who the deal is waiting on, for what, and for how long,
 * with the stage against its benchmark underneath (spec
 * docs/plans/2026-09-05-stall-attribution-spec.md, surfaces 1 and 2).
 *
 * Roles only, never a name. Free for every tier. Reads the server's answer
 * (stall.service) so this line, the other-party card and the conveyancer
 * desk can never disagree about whose move it is.
 */
import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import {
  describeStage,
  describeStall,
  loadDealStage,
  loadDealStalls,
  longestWait,
  ownerSide,
  type DealStage,
  type DealStall,
} from '@/services/stall.service';
import type { DealSide } from '@/services/shareParty.service';
import { logger } from '@/utils/logger';

interface StallLineProps {
  transactionId: string;
  /** Bump to re-read after an on-chain edit lands, same as NextStepCard. */
  refreshKey?: number | string;
  /** Only the stalls owed by this side (the other-party card shows theirs). */
  side?: DealSide;
  /** `full` adds the stage line and the count of further stalls; `compact` is one line. */
  variant?: 'full' | 'compact';
  className?: string;
}

interface Loaded {
  stalls: DealStall[];
  stage: DealStage | null;
}

export function StallLine({
  transactionId,
  refreshKey,
  side,
  variant = 'full',
  className = '',
}: StallLineProps): JSX.Element | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    // Clear first: switching transaction must not show the old deal's line
    // while the new read is in flight.
    setLoaded(null);
    // Decoration on the page, not a gate: an unreadable read is logged and
    // the page carries on without it. The two reads are independent, so a
    // stage that cannot be read never hides the stalls, nor the other way.
    const stalls = loadDealStalls(transactionId).catch((error: unknown) => {
      logger.warn('Stalls unavailable', error);
      return [] as DealStall[];
    });
    const stage: Promise<DealStage | null> = variant === 'full'
      ? loadDealStage(transactionId).catch((error: unknown) => {
        logger.warn('Stage unavailable', error);
        return null;
      })
      : Promise.resolve(null);
    void Promise.all([stalls, stage]).then(([s, st]) => {
      if (active) setLoaded({ stalls: s, stage: st });
    });
    return () => {
      active = false;
    };
  }, [transactionId, refreshKey, variant]);

  if (!loaded) return null;

  const relevant = side ? loaded.stalls.filter((s) => ownerSide(s.owner) === side) : loaded.stalls;
  const top = longestWait(relevant);
  const stage = variant === 'full' ? loaded.stage : null;
  if (!top && !stage) return null;
  const more = relevant.length - 1;

  return (
    <div data-testid="stall-line" data-owner={top?.owner ?? ''} className={className}>
      {top && (
        <p className="flex items-start gap-2 font-sans text-sm text-stone-700 dark:text-slate-300">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            {describeStall(top)}
            {variant === 'full' && more > 0 ? ` (+${more} more waiting)` : ''}
          </span>
        </p>
      )}
      {stage && (
        <p data-testid="stage-line" className="mt-1 pl-6 font-sans text-xs text-stone-500 dark:text-slate-400">
          {describeStage(stage)}
        </p>
      )}
    </div>
  );
}
