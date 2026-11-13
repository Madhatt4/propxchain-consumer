// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useEffect, useRef } from 'react';

import { toast } from '../../hooks/use-toast';
import {
  getCanisterRateLimiter,
  isRateLimitFailure,
  type RateLimitEventData,
} from '../../services/canisterRateLimiter';

/** One popup per burst: further failures inside this window stay silent. */
const QUIET_WINDOW_MS = 10_000;

/**
 * Tells the user when a canister call gave up after waiting for the rate
 * limiter. It used to fire a red "Rate Limit Reached" popup (and an amber
 * warning) whenever the bucket ran low, which on a busy page is normal and
 * harmless since calls wait their turn. Now it speaks only when something
 * really failed. Mount once, in the app layout.
 */
export const RateLimitToast: React.FC = () => {
  const lastShownAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Subscribed directly, not via context state: React batches state
    // updates, so a FAILURE followed at once by a SUCCESS could be lost.
    const listener = (event: RateLimitEventData): void => {
      if (!isRateLimitFailure(event)) return;
      const last = lastShownAtRef.current;
      if (last !== null && event.timestamp - last < QUIET_WINDOW_MS) return;
      lastShownAtRef.current = event.timestamp;
      toast({
        variant: 'destructive',
        title: 'Still busy',
        description: 'Some details took too long to load. Please try again in a moment.',
      });
    };

    const rateLimiter = getCanisterRateLimiter();
    rateLimiter.addEventListener(listener);
    return () => rateLimiter.removeEventListener(listener);
  }, []);

  return null;
};

export default RateLimitToast;
