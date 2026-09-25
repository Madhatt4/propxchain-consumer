/**
 * PropXchain - SolicitorTaskCard Component
 * Individual task card for the Legal tab showing task status, price, timestamps.
 */

import React from 'react';
import type { SolicitorTask } from '../../types/solicitor.types';
import { SOLICITOR_TASK_LABELS } from '../../types/solicitor.types';

interface SolicitorTaskCardProps {
  task: SolicitorTask;
  dependencyNote?: string;
  isActive: boolean;
}

const formatTimestamp = (ns: bigint | null): string => {
  if (!ns) return '';
  try {
    return new Date(Number(ns / BigInt(1_000_000))).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const STATUS_CONFIG = {
  pending: {
    dot: 'bg-gray-500',
    badge: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    label: 'Pending',
  },
  in_progress: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700/50',
    label: 'In Progress',
  },
  completed: {
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700/50',
    label: 'Completed',
  },
  confirmed_by_client: {
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700/50',
    label: 'Confirmed',
  },
} as const;

const SolicitorTaskCard: React.FC<SolicitorTaskCardProps> = ({ task, dependencyNote, isActive }) => {
  const config = STATUS_CONFIG[task.status];
  const labels = SOLICITOR_TASK_LABELS[task.taskType];
  const startedAt = formatTimestamp(task.startedAt);
  const completedAt = formatTimestamp(task.completedAt);

  return (
    <div
      className={`rounded-lg p-4 border transition-opacity ${
        isActive
          ? 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800/60'
          : 'border-gray-300 bg-white dark:border-gray-700/40 dark:bg-gray-800/20 opacity-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: dot + name */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${config.dot}`} />
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white font-semibold text-sm leading-snug">{labels.name}</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5 leading-relaxed">{labels.description}</p>
            {dependencyNote && (
              <p className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-1 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {dependencyNote}
              </p>
            )}
          </div>
        </div>

        {/* Right: badge + price */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
            {config.label}
          </span>
          <span className="text-gray-900 dark:text-white font-semibold text-sm">
            £{task.priceGBP.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Timestamps */}
      {(startedAt || completedAt) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/60 flex flex-wrap gap-4">
          {startedAt && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wide">Started</p>
              <p className="text-gray-700 dark:text-gray-300 text-xs">{startedAt}</p>
            </div>
          )}
          {completedAt && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wide">Completed</p>
              <p className="text-gray-700 dark:text-gray-300 text-xs">{completedAt}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SolicitorTaskCard;
