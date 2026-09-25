// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useEffect, useRef, useState } from 'react';
import { useRateLimit } from '../../contexts/RateLimitContext';
import { toast } from '../../hooks/use-toast';

/**
 * Rate Limit Toast Manager Component
 *
 * This component monitors the rate limit status and displays toast notifications
 * to inform users when they are approaching or have hit rate limits.
 *
 * Features:
 * - Warning toast when approaching limit (80% usage)
 * - Error toast when rate limited with retry countdown
 * - Actionable messages guiding users on what to do
 * - Prevents duplicate toasts for the same state
 * - Auto-dismisses when rate limit is lifted
 *
 * @example
 * ```tsx
 * // Add to your app layout (only once)
 * <RateLimitToast />
 * ```
 */
export const RateLimitToast: React.FC = () => {
  const { read, write, isRateLimited } = useRateLimit();
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [hasShownError, setHasShownError] = useState(false);
  const activeToastRef = useRef<{ id: string; dismiss: () => void } | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Format time in milliseconds to a human-readable countdown
   */
  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return 'now';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  /**
   * Determine which operation type is closest to rate limit
   */
  const getClosestToLimit = (): { type: 'read' | 'write'; percent: number; timeUntilRefresh: number } => {
    const readPercent = read.maxTokens > 0 ? (read.availableTokens / read.maxTokens) * 100 : 100;
    const writePercent = write.maxTokens > 0 ? (write.availableTokens / write.maxTokens) * 100 : 100;

    if (readPercent <= writePercent) {
      return { type: 'read', percent: readPercent, timeUntilRefresh: read.timeUntilRefresh };
    }
    return { type: 'write', percent: writePercent, timeUntilRefresh: write.timeUntilRefresh };
  };

  /**
   * Dismiss active toast and clear countdown
   */
  const dismissActiveToast = () => {
    if (activeToastRef.current) {
      activeToastRef.current.dismiss();
      activeToastRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  /**
   * Show rate limited error toast with countdown
   */
  const showRateLimitedToast = (operationType: 'read' | 'write', initialTimeUntilRefresh: number) => {
    dismissActiveToast();

    let currentTime = initialTimeUntilRefresh;
    const operationLabel = operationType === 'read' ? 'Read operations' : 'Write operations';

    const showToast = (timeRemaining: number) => {
      if (activeToastRef.current) {
        activeToastRef.current.dismiss();
      }

      const toastInstance = toast({
        variant: 'destructive',
        title: 'Rate Limit Reached',
        description: timeRemaining > 0
          ? `${operationLabel} are temporarily limited. Try again in ${formatCountdown(timeRemaining)}.`
          : `${operationLabel} are temporarily limited. You can try again now.`,
      });

      activeToastRef.current = toastInstance;
    };

    showToast(currentTime);

    countdownIntervalRef.current = setInterval(() => {
      currentTime -= 1000;
      if (currentTime <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        showToast(0);
      } else {
        showToast(currentTime);
      }
    }, 1000);

    setHasShownError(true);
    setHasShownWarning(false);
  };

  /**
   * Show warning toast when approaching limit
   */
  const showWarningToast = (operationType: 'read' | 'write', percent: number) => {
    dismissActiveToast();

    const operationLabel = operationType === 'read' ? 'read' : 'write';
    const percentUsed = Math.round(100 - percent);

    const toastInstance = toast({
      variant: 'default',
      title: 'Approaching Rate Limit',
      description: `You've used ${percentUsed}% of your ${operationLabel} operations. Please slow down to avoid being rate limited.`,
    });

    activeToastRef.current = toastInstance;
    setHasShownWarning(true);
  };

  /**
   * Monitor rate limit status and show appropriate toasts
   */
  useEffect(() => {
    const { type, percent } = getClosestToLimit();

    if (isRateLimited) {
      if (!hasShownError) {
        const rateLimitedType = read.isRateLimited ? 'read' : 'write';
        const timeUntil = read.isRateLimited ? read.timeUntilRefresh : write.timeUntilRefresh;
        showRateLimitedToast(rateLimitedType, timeUntil);
      }
    } else if (percent <= 20) {
      setHasShownError(false);
      if (!hasShownWarning) {
        showWarningToast(type, percent);
      }
    } else {
      if (hasShownWarning || hasShownError) {
        dismissActiveToast();
        setHasShownWarning(false);
        setHasShownError(false);
      }
    }
  }, [read.isRateLimited, write.isRateLimited, read.availableTokens, write.availableTokens, isRateLimited]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      dismissActiveToast();
    };
  }, []);

  return null;
};

export default RateLimitToast;
