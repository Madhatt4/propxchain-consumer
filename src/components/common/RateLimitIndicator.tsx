// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect, useRef } from 'react';
import { useRateLimit } from '../../contexts/RateLimitContext';

interface RateLimitIndicatorProps {
  className?: string;
}

/**
 * RateLimitIndicator Component
 *
 * A non-intrusive indicator that shows the current rate limit status.
 * Displays a color-coded icon (green/yellow/red) based on API usage
 * with a tooltip showing detailed information about rate limits.
 *
 * - Green: Healthy (>50% tokens available)
 * - Yellow: Warning (20-50% tokens available)
 * - Red: Critical (<20% tokens available or rate limited)
 *
 * @example
 * ```tsx
 * <RateLimitIndicator className="ml-4" />
 * ```
 */
const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({ className = '' }) => {
  const { read, write, isRateLimited, queueLength } = useRateLimit();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Calculate the overall status based on read and write token availability
   */
  const getStatus = (): 'healthy' | 'warning' | 'critical' => {
    if (isRateLimited) {
      return 'critical';
    }

    // Calculate percentage of available tokens
    const readPercent = read.maxTokens > 0 ? (read.availableTokens / read.maxTokens) * 100 : 100;
    const writePercent = write.maxTokens > 0 ? (write.availableTokens / write.maxTokens) * 100 : 100;

    // Use the lower percentage as the overall health
    const minPercent = Math.min(readPercent, writePercent);

    if (minPercent > 50) return 'healthy';
    if (minPercent > 20) return 'warning';
    return 'critical';
  };

  /**
   * Get color classes based on status
   */
  const getColorClasses = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'text-green-500 dark:text-green-400';
      case 'warning':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'critical':
        return 'text-red-500 dark:text-red-400';
    }
  };

  /**
   * Format time in milliseconds to a human-readable format
   */
  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'now';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  /**
   * Get status message
   */
  const getStatusMessage = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'healthy':
        return 'API usage is healthy';
      case 'warning':
        return 'API usage is elevated';
      case 'critical':
        return isRateLimited ? 'Rate limited - please wait' : 'API usage is critical';
    }
  };

  const status = getStatus();
  const colorClasses = getColorClasses(status);

  return (
    <div className={`relative ${className}`} ref={tooltipRef}>
      {/* Indicator Icon.
          Icon-only, and it sits in the SHARED dashboard header so it appears
          on every dashboard page. Measured at 36px in production 2026-07-31 —
          the smallest control in that cluster. Icon buttons get no inline
          exception, so it takes the full 44px (WCAG 2.5.5). */}
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${colorClasses}`}
        aria-label="Rate limit status"
        title="Click for rate limit details"
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          {status === 'healthy' && (
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          )}
          {status === 'warning' && (
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          )}
          {status === 'critical' && (
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          )}
        </svg>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Rate Limit Status
              </h3>
              <span className={`text-xs font-medium ${colorClasses}`}>
                {getStatusMessage(status)}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-3 space-y-3">
            {/* Read Operations */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Read Operations
                </span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {read.availableTokens}/{read.maxTokens}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    read.isRateLimited
                      ? 'bg-red-500'
                      : read.availableTokens / read.maxTokens > 0.5
                      ? 'bg-green-500'
                      : read.availableTokens / read.maxTokens > 0.2
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{
                    width: `${read.maxTokens > 0 ? (read.availableTokens / read.maxTokens) * 100 : 0}%`
                  }}
                />
              </div>
              {read.isRateLimited && read.timeUntilRefresh > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Next token in {formatTime(read.timeUntilRefresh)}
                </p>
              )}
            </div>

            {/* Write Operations */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Write Operations
                </span>
                <span className="text-xs text-gray-900 dark:text-white">
                  {write.availableTokens}/{write.maxTokens}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    write.isRateLimited
                      ? 'bg-red-500'
                      : write.availableTokens / write.maxTokens > 0.5
                      ? 'bg-green-500'
                      : write.availableTokens / write.maxTokens > 0.2
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{
                    width: `${write.maxTokens > 0 ? (write.availableTokens / write.maxTokens) * 100 : 0}%`
                  }}
                />
              </div>
              {write.isRateLimited && write.timeUntilRefresh > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Next token in {formatTime(write.timeUntilRefresh)}
                </p>
              )}
            </div>

            {/* Queue Status */}
            {queueLength > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Queued Requests
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {queueLength}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Rate limits help prevent excessive API calls and protect system resources.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateLimitIndicator;
