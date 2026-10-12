// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One line, for everyone on the deal, once the buyer's mortgage offer is
 * within a month of running out or has run out (services/offerExpiry.ts).
 * Silent while there is no confirmed date or plenty of time is left.
 */
import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { loadBuyerPack } from '@/services/buyerPack.service';
import { describeOfferExpiry, offerExpiryFromPack, type OfferExpiry } from '@/services/offerExpiry';
import { logger } from '@/utils/logger';

interface OfferExpiryLineProps {
  transactionId: string;
  refreshKey?: number | string;
  className?: string;
  /** Test seam: skip the Buyer Pack read. */
  expiryOverride?: OfferExpiry | null;
}

export function OfferExpiryLine({ transactionId, refreshKey, className = '', expiryOverride }: OfferExpiryLineProps): JSX.Element | null {
  const [loaded, setLoaded] = useState<OfferExpiry | null>(null);

  useEffect(() => {
    if (expiryOverride !== undefined) return;
    let active = true;
    setLoaded(null);
    loadBuyerPack(transactionId)
      .then((items) => { if (active) setLoaded(offerExpiryFromPack(items, Date.now())); })
      .catch((error: unknown) => logger.warn('Offer expiry unavailable', error));
    return () => {
      active = false;
    };
  }, [transactionId, refreshKey, expiryOverride]);

  const expiry = expiryOverride !== undefined ? expiryOverride : loaded;
  if (!expiry || expiry.state === 'ok') return null;
  const expired = expiry.state === 'expired';
  return (
    <p
      data-testid="offer-expiry-line"
      data-state={expiry.state}
      role={expired ? 'alert' : undefined}
      className={`flex items-start gap-2 font-sans text-sm ${expired ? 'text-red-700 dark:text-red-400' : 'text-stone-700 dark:text-slate-300'} ${className}`}
    >
      <CalendarClock
        className={`mt-0.5 h-4 w-4 shrink-0 ${expired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}
        aria-hidden
      />
      <span>{describeOfferExpiry(expiry)}</span>
    </p>
  );
}
