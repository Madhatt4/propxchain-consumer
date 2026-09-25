/**
 * PropXchain - SolicitorCard Component
 * Dashboard summary card showing solicitor status in 4 states:
 * none → pending → active → complete
 */

import React from 'react';
import type { SolicitorRecord, SolicitorTaskType } from '../../types/solicitor.types';

interface SolicitorCardProps {
  solicitor: SolicitorRecord | null;
  isPending: boolean;
  onInvite: () => void;
  onResend?: () => void;
  onViewLegalTab?: () => void;
}

const TASK_ORDER: SolicitorTaskType[] = [
  'tr1_preparation',
  'ap1_submission',
  'identity_certification',
];

const SolicitorCard: React.FC<SolicitorCardProps> = ({
  solicitor,
  isPending,
  onInvite,
  onResend,
  onViewLegalTab,
}) => {
  // Derive state
  const isComplete =
    solicitor !== null &&
    solicitor.tasks.every((t) => t.status === 'completed' || t.status === 'confirmed_by_client');

  const totalFees =
    solicitor?.tasks.reduce((sum, t) => sum + t.priceGBP, 0) ?? 0;

  // --- State: No solicitor ---
  if (!solicitor && !isPending) {
    return (
      <div className="rounded-xl p-5 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800/40 flex flex-col items-center justify-center gap-3 text-center min-h-[120px]">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p className="text-gray-900 dark:text-white font-semibold text-sm">No Solicitor Assigned</p>
          <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">Invite a solicitor or conveyancer to handle restricted tasks</p>
        </div>
        <button
          onClick={onInvite}
          className="mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Invite Solicitor / Conveyancer
        </button>
      </div>
    );
  }

  // --- State: Pending ---
  if (isPending && !solicitor) {
    return (
      <div className="rounded-xl p-5 border-2 border-amber-500/60 bg-amber-500/5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-700 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white font-semibold text-sm">Solicitor Invited</p>
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">Awaiting acceptance</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap">
            Pending
          </span>
        </div>
        {onResend && (
          <button
            onClick={onResend}
            className="self-start px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-lg transition-colors"
          >
            Resend Invite
          </button>
        )}
      </div>
    );
  }

  // --- State: Complete ---
  if (isComplete && solicitor) {
    return (
      <div className="rounded-xl p-5 border-2 border-green-500/50 bg-green-500/5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-green-700 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white font-semibold text-sm">All restricted tasks completed</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
              {solicitor.name} &middot; {solicitor.firmName}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400 text-xs">Fees settled</span>
          <span className="text-green-700 dark:text-green-400 font-semibold text-sm">£{totalFees.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // --- State: Active ---
  if (solicitor) {
    const completedCount = solicitor.tasks.filter(
      (t) => t.status === 'completed' || t.status === 'confirmed_by_client'
    ).length;
    const totalTasks = solicitor.tasks.length || TASK_ORDER.length;
    const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const getInitials = (name: string): string => {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    };

    const getTaskStatus = (taskType: SolicitorTaskType): 'pending' | 'in_progress' | 'completed' => {
      const task = solicitor.tasks.find((t) => t.taskType === taskType);
      if (!task) return 'pending';
      if (task.status === 'completed' || task.status === 'confirmed_by_client') return 'completed';
      if (task.status === 'in_progress') return 'in_progress';
      return 'pending';
    };

    const statusDot = (status: 'pending' | 'in_progress' | 'completed'): string => {
      if (status === 'completed') return 'bg-green-500';
      if (status === 'in_progress') return 'bg-amber-500';
      return 'bg-gray-500';
    };

    const taskPillLabel: Record<SolicitorTaskType, string> = {
      tr1_preparation: 'TR1',
      ap1_submission: 'AP1',
      identity_certification: 'ID Cert',
    };

    return (
      <div className="rounded-xl p-5 border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/60 flex flex-col gap-4">
        {/* Profile row */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {getInitials(solicitor.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-gray-900 dark:text-white font-semibold text-sm leading-tight">{solicitor.name}</p>
              {solicitor.verified && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700/50 font-medium">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  VERIFIED
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs truncate">{solicitor.firmName}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              {solicitor.regulatoryBody.toUpperCase()} #{solicitor.regNumber}
            </p>
          </div>
        </div>

        {/* Task mini-pills */}
        <div className="flex gap-2 flex-wrap">
          {TASK_ORDER.map((taskType) => {
            const status = getTaskStatus(taskType);
            return (
              <span
                key={taskType}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  status === 'completed'
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/50'
                    : status === 'in_progress'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/50'
                    : 'bg-gray-200 text-gray-600 border-gray-300 dark:bg-gray-700/60 dark:text-gray-400 dark:border-gray-600/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(status)}`} />
                {taskPillLabel[taskType]}
              </span>
            );
          })}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-600 dark:text-gray-400 text-xs">Task Progress</span>
            <span className="text-gray-700 dark:text-gray-300 text-xs font-semibold">{completedCount}/{totalTasks}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500 bg-blue-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400 text-xs">
            Total fees: <span className="text-gray-900 dark:text-white font-semibold">£{totalFees.toLocaleString()}</span>
          </span>
          {onViewLegalTab && (
            <button
              onClick={onViewLegalTab}
              className="text-blue-700 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium transition-colors"
            >
              View Legal Tab →
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export { SolicitorCard };
export default SolicitorCard;
