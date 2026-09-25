// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getCanisterRateLimiter,
  RateLimitEvent,
  RateLimitEventData
} from '../services/canisterRateLimiter';
import type { RateLimitStatus } from '../utils/rateLimiter';

/**
 * Rate limit context state for a specific operation type
 */
export interface OperationRateLimitState {
  /** Whether this operation type is currently rate limited */
  isRateLimited: boolean;
  /** Number of tokens available for this operation */
  availableTokens: number;
  /** Maximum tokens for this operation */
  maxTokens: number;
  /** Time in milliseconds until next token is available */
  timeUntilRefresh: number;
}

/**
 * Rate limit context value exposed to components
 */
export interface RateLimitContextType {
  /** Rate limit state for read operations */
  read: OperationRateLimitState;
  /** Rate limit state for write operations */
  write: OperationRateLimitState;
  /** Overall rate limited status (true if any operation is limited) */
  isRateLimited: boolean;
  /** Queue status information */
  queueLength: number;
  /** Refresh rate limit status manually */
  refresh: () => void;
  /** Last rate limit event that occurred */
  lastEvent: RateLimitEventData | null;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

/**
 * Provider props
 */
interface RateLimitProviderProps {
  children: ReactNode;
  /** How often to poll for status updates (ms), default: 1000 */
  updateInterval?: number;
}

/**
 * Rate Limit Context Provider
 *
 * Provides rate limit status across the application, allowing components
 * to react to rate limiting conditions. Automatically updates when rate
 * limit events occur and polls for status changes.
 *
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * <RateLimitProvider>
 *   <App />
 * </RateLimitProvider>
 *
 * // Use the hook in components
 * const { isRateLimited, read, write } = useRateLimit();
 * ```
 */
export const RateLimitProvider: React.FC<RateLimitProviderProps> = ({
  children,
  updateInterval = 1000
}) => {
  const [readState, setReadState] = useState<OperationRateLimitState>({
    isRateLimited: false,
    availableTokens: 10,
    maxTokens: 10,
    timeUntilRefresh: 0
  });

  const [writeState, setWriteState] = useState<OperationRateLimitState>({
    isRateLimited: false,
    availableTokens: 3,
    maxTokens: 3,
    timeUntilRefresh: 0
  });

  const [queueLength, setQueueLength] = useState<number>(0);
  const [lastEvent, setLastEvent] = useState<RateLimitEventData | null>(null);

  /**
   * Convert RateLimitStatus to OperationRateLimitState
   */
  const convertStatus = useCallback((status: RateLimitStatus | null): OperationRateLimitState => {
    if (!status) {
      return {
        isRateLimited: false,
        availableTokens: 0,
        maxTokens: 0,
        timeUntilRefresh: 0
      };
    }

    return {
      isRateLimited: status.isLimited,
      availableTokens: status.availableTokens,
      maxTokens: status.maxTokens,
      timeUntilRefresh: status.timeUntilNextToken
    };
  }, []);

  /**
   * Update rate limit status from the canister rate limiter
   */
  const updateStatus = useCallback(() => {
    const rateLimiter = getCanisterRateLimiter();

    // Get status for read and write operations
    const readStatus = rateLimiter.getRateLimitStatus('read');
    const writeStatus = rateLimiter.getRateLimitStatus('write');

    // Get queue status
    const queueStatus = rateLimiter.getQueueStatus();

    // Update state
    setReadState(convertStatus(readStatus));
    setWriteState(convertStatus(writeStatus));
    setQueueLength(queueStatus.pendingCount);
  }, [convertStatus]);

  /**
   * Handle rate limit events from the canister rate limiter
   */
  const handleRateLimitEvent = useCallback((event: RateLimitEventData) => {
    setLastEvent(event);

    // Immediately update status when rate limit events occur
    if (
      event.event === RateLimitEvent.RATE_LIMITED ||
      event.event === RateLimitEvent.SUCCESS ||
      event.event === RateLimitEvent.FAILURE
    ) {
      updateStatus();
    }
  }, [updateStatus]);

  /**
   * Setup event listener and polling on mount
   */
  useEffect(() => {
    const rateLimiter = getCanisterRateLimiter();

    // Initial status update
    updateStatus();

    // Add event listener for real-time updates
    rateLimiter.addEventListener(handleRateLimitEvent);

    // Setup polling interval for status updates
    const intervalId = setInterval(updateStatus, updateInterval);

    // Cleanup on unmount
    return () => {
      rateLimiter.removeEventListener(handleRateLimitEvent);
      clearInterval(intervalId);
    };
  }, [updateStatus, handleRateLimitEvent, updateInterval]);

  const value: RateLimitContextType = {
    read: readState,
    write: writeState,
    isRateLimited: readState.isRateLimited || writeState.isRateLimited,
    queueLength,
    refresh: updateStatus,
    lastEvent
  };

  return (
    <RateLimitContext.Provider value={value}>
      {children}
    </RateLimitContext.Provider>
  );
};

/**
 * Hook to access rate limit context
 *
 * @throws Error if used outside of RateLimitProvider
 * @returns Rate limit context value
 *
 * @example
 * ```tsx
 * const { isRateLimited, read, write, queueLength } = useRateLimit();
 *
 * if (read.isRateLimited) {
 *   return <div>Too many requests. Please wait {read.timeUntilRefresh}ms</div>;
 * }
 *
 * return <div>Available: {read.availableTokens}/{read.maxTokens}</div>;
 * ```
 */
export const useRateLimit = (): RateLimitContextType => {
  const context = useContext(RateLimitContext);
  if (context === undefined) {
    throw new Error('useRateLimit must be used within a RateLimitProvider');
  }
  return context;
};

export default RateLimitContext;
