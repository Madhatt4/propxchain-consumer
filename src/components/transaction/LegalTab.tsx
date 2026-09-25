/**
 * PropXchain - LegalTab Component
 * Full Legal tab content: solicitor profile, restricted tasks, fee summary,
 * and consent/compliance audit trail.
 */

import React from 'react';
import type { SolicitorRecord, SolicitorTaskType } from '../../types/solicitor.types';
import SolicitorTaskCard from './SolicitorTaskCard';

interface LegalTabProps {
  buyerSolicitor: SolicitorRecord | null;
  sellerSolicitor: SolicitorRecord | null;
}

const TASK_ORDER: SolicitorTaskType[] = [
  'tr1_preparation',
  'ap1_submission',
  'identity_certification',
];

const DEPENDENCY_NOTES: Partial<Record<SolicitorTaskType, string>> = {
  ap1_submission: 'Requires TR1 to be completed first',
  identity_certification: 'Requires AP1 submission to be in progress',
};

const formatTimestamp = (ns: bigint): string => {
  try {
    return new Date(Number(ns / BigInt(1_000_000))).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown date';
  }
};

interface SolicitorSectionProps {
  solicitor: SolicitorRecord;
  side: 'buyer' | 'seller';
}

const SolicitorSection: React.FC<SolicitorSectionProps> = ({ solicitor, side }) => {
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const totalFees = solicitor.tasks.reduce((sum, t) => sum + t.priceGBP, 0);

  // Task is active if the one before it is completed (or it's the first task)
  const isTaskActive = (taskType: SolicitorTaskType): boolean => {
    const idx = TASK_ORDER.indexOf(taskType);
    if (idx === 0) return true;
    const prevTask = solicitor.tasks.find((t) => t.taskType === TASK_ORDER[idx - 1]);
    if (!prevTask) return false;
    return prevTask.status === 'completed' || prevTask.status === 'confirmed_by_client';
  };

  const sideLabel = side === 'buyer' ? "Buyer's Solicitor" : "Seller's Solicitor";
  const sideColor = side === 'buyer' ? 'text-emerald-700 dark:text-emerald-400' : 'text-purple-700 dark:text-purple-400';
  const sideBorder = side === 'buyer' ? 'border-emerald-200 dark:border-emerald-700/30' : 'border-purple-200 dark:border-purple-700/30';

  return (
    <div className={`rounded-xl border ${sideBorder} bg-gray-100 dark:bg-gray-800/40 overflow-hidden`}>
      {/* Section header */}
      <div className="px-5 py-3 border-b border-gray-300 dark:border-gray-700/50 bg-white dark:bg-gray-900/40">
        <span className={`text-xs font-semibold uppercase tracking-wider ${sideColor}`}>
          {sideLabel}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* 1. Solicitor Profile Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base shrink-0">
            {getInitials(solicitor.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base">{solicitor.name}</h3>
              {solicitor.verified && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700/50 font-semibold">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  VERIFIED
                </span>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm">{solicitor.firmName}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-gray-600 dark:text-gray-400 text-xs">
                {solicitor.regulatoryBody.toUpperCase()} #{solicitor.regNumber}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                solicitor.piiCertUploaded
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                PII {solicitor.piiCertUploaded ? 'Uploaded' : 'Pending'}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                Acting for:{' '}
                <span className="text-gray-700 dark:text-gray-300 capitalize">
                  {solicitor.actingFor === 'both' ? 'Both parties' : solicitor.actingFor}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* 2. Restricted Tasks */}
        <div>
          <h4 className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-700 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Restricted Tasks
          </h4>
          <div className="flex flex-col gap-3">
            {TASK_ORDER.map((taskType) => {
              const task = solicitor.tasks.find((t) => t.taskType === taskType);
              if (!task) return null;
              return (
                <SolicitorTaskCard
                  key={taskType}
                  task={task}
                  dependencyNote={DEPENDENCY_NOTES[taskType]}
                  isActive={isTaskActive(taskType)}
                />
              );
            })}
          </div>
        </div>

        {/* 3. Fee Summary */}
        <div className="rounded-lg border border-gray-300 dark:border-gray-700/60 bg-white dark:bg-gray-900/30 p-4">
          <h4 className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-3">Fee Summary</h4>
          <div className="flex flex-col gap-2">
            {TASK_ORDER.map((taskType) => {
              const task = solicitor.tasks.find((t) => t.taskType === taskType);
              if (!task) return null;
              const labels = { tr1_preparation: 'TR1 Preparation', ap1_submission: 'AP1 Submission', identity_certification: 'Identity Certification' } as const;
              return (
                <div key={taskType} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-xs">{labels[taskType]}</span>
                  <span className="text-gray-800 dark:text-gray-200 text-xs font-medium">£{task.priceGBP.toLocaleString()}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700/60 mt-1">
              <span className="text-gray-900 dark:text-white text-sm font-semibold">Total</span>
              <span className="text-gray-900 dark:text-white text-sm font-bold">£{totalFees.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-3 leading-relaxed">
            Funds are held in the conveyancer client account and released upon task confirmation.
          </p>
        </div>

        {/* 4. Consent & Compliance */}
        <div>
          <h4 className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Consent &amp; Compliance
          </h4>
          <div className="flex flex-col gap-2">
            {/* Buyer consent */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-300 dark:bg-gray-900/40 dark:border-gray-700/40">
              <svg className="w-4 h-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-gray-700 dark:text-gray-300 text-xs font-medium">Buyer Consent Recorded</p>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Transaction data sharing approved</p>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] shrink-0">{formatTimestamp(solicitor.consentRecordedAt)}</span>
            </div>

            {/* Solicitor consent */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-300 dark:bg-gray-900/40 dark:border-gray-700/40">
              <svg className="w-4 h-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-gray-700 dark:text-gray-300 text-xs font-medium">Solicitor Consent Recorded</p>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Professional terms &amp; data processing accepted</p>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] shrink-0">{formatTimestamp(solicitor.joinedAt)}</span>
            </div>

            {/* SRA verification */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-300 dark:bg-gray-900/40 dark:border-gray-700/40">
              {solicitor.verified ? (
                <svg className="w-4 h-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-gray-700 dark:text-gray-300 text-xs font-medium">
                  {solicitor.regulatoryBody.toUpperCase()} Verification
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                  {solicitor.verified ? 'Identity and registration confirmed' : 'Verification pending'}
                </p>
              </div>
              <span className={`text-[11px] shrink-0 font-medium ${solicitor.verified ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {solicitor.verified ? 'Verified' : 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LegalTab: React.FC<LegalTabProps> = ({ buyerSolicitor, sellerSolicitor }) => {
  const hasSolicitor = buyerSolicitor !== null || sellerSolicitor !== null;

  if (!hasSolicitor) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="text-gray-900 dark:text-white font-semibold text-base">No Solicitor Assigned</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 max-w-sm">
            When a solicitor joins this transaction, their profile and restricted tasks will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {buyerSolicitor && (
        <SolicitorSection solicitor={buyerSolicitor} side="buyer" />
      )}
      {sellerSolicitor && (
        <SolicitorSection solicitor={sellerSolicitor} side="seller" />
      )}
    </div>
  );
};

export default LegalTab;
