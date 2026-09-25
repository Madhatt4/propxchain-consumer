// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import type {
  OscarAnalysisResult,
  OscarIssue,
  DataMismatch
} from '../../types/oscar.types';

interface OscarAnalysisPanelProps {
  result: OscarAnalysisResult;
  onSolicitorOverride?: (approved: boolean, notes: string) => void;
  canOverride?: boolean;
  compact?: boolean;
}

type SeverityStyle = {
  bg: string;
  border: string;
  text: string;
};

const SEVERITY_STYLES: Record<OscarIssue['severity'], SeverityStyle> = {
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-700/50',
    text: 'text-red-800 dark:text-red-300'
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-700/50',
    text: 'text-yellow-800 dark:text-yellow-300'
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700/50',
    text: 'text-blue-800 dark:text-blue-300'
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 85) return '#16a34a'; // green-600
  if (confidence >= 70) return '#ca8a04'; // yellow-600
  return '#dc2626'; // red-600
};

const OscarAnalysisPanel: React.FC<OscarAnalysisPanelProps> = ({
  result,
  onSolicitorOverride,
  canOverride = false,
  compact = false
}) => {
  const [overrideNotes, setOverrideNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(!compact);

  const handleApprove = (): void => {
    if (onSolicitorOverride) {
      onSolicitorOverride(true, overrideNotes);
    }
  };

  const handleReject = (): void => {
    if (onSolicitorOverride) {
      onSolicitorOverride(false, overrideNotes);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const renderIssue = (issue: OscarIssue, idx: number): React.ReactElement => {
    const style = SEVERITY_STYLES[issue.severity];
    return (
      <div
        key={idx}
        className={`p-2 rounded border ${style.bg} ${style.border} ${style.text}`}
      >
        <div className="flex items-start gap-2">
          <span className="font-medium capitalize">{issue.severity}:</span>
          <span>{issue.message}</span>
        </div>
        {issue.field && (
          <div className="text-xs mt-1 opacity-75">Field: {issue.field}</div>
        )}
        {issue.code && (
          <div className="text-xs mt-1 opacity-75">Code: {issue.code}</div>
        )}
      </div>
    );
  };

  const renderMismatch = (
    mismatch: DataMismatch,
    idx: number
  ): React.ReactElement => (
    <div key={idx} className="text-sm py-1">
      <span className="font-medium">{mismatch.field}:</span>
      <span className="ml-2">
        Expected &quot;{mismatch.expected}&quot; but found &quot;{mismatch.found}
        &quot;
      </span>
    </div>
  );

  const renderExtractedData = (): React.ReactElement | null => {
    const entries = Object.entries(result.extractedData);
    if (entries.length === 0) return null;

    const displayEntries = compact ? entries.slice(0, 3) : entries.slice(0, 8);

    return (
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded p-3 text-sm">
        {displayEntries.map(([key, value]) => (
          <div key={key} className="flex justify-between py-1">
            <span className="text-gray-600 dark:text-gray-400">{key}:</span>
            <span className="font-medium truncate max-w-[60%]">
              {String(value)}
            </span>
          </div>
        ))}
        {entries.length > displayEntries.length && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            +{entries.length - displayEntries.length} more fields
          </div>
        )}
      </div>
    );
  };

  if (compact && !isExpanded) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Oscar Analysis
            </span>
            <div
              className="text-lg font-bold"
              style={{ color: getConfidenceColor(result.confidence) }}
            >
              {result.confidence}%
            </div>
            {result.issues.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({result.issues.length} issue
                {result.issues.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Show Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
      {/* Header with confidence score */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Oscar AI Analysis</h3>
        <div className="flex items-center gap-2">
          <div
            className="text-2xl font-bold"
            style={{ color: getConfidenceColor(result.confidence) }}
          >
            {result.confidence}%
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">confidence</span>
          {compact && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="ml-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Collapse panel"
            >
              Hide
            </button>
          )}
        </div>
      </div>

      {/* Verification Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
        <span
          className={`px-2 py-0.5 rounded text-sm font-medium ${
            result.verified
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
          }`}
        >
          {result.verified ? 'Verified' : 'Requires Review'}
        </span>
      </div>

      {/* Issues List */}
      {result.issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Issues Found ({result.issues.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {result.issues.map((issue, idx) => renderIssue(issue, idx))}
          </div>
        </div>
      )}

      {/* Data Mismatches */}
      {result.mismatches.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Mismatches</h4>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/50 rounded p-3">
            {result.mismatches.map((m, idx) => renderMismatch(m, idx))}
          </div>
        </div>
      )}

      {/* Extracted Data Preview */}
      {Object.keys(result.extractedData).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Extracted Data</h4>
          {renderExtractedData()}
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recommendations</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {result.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Solicitor Override Section */}
      {canOverride && result.requiresSolicitorReview && onSolicitorOverride && (
        <div className="border-t dark:border-slate-700 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Solicitor Override
          </h4>
          <textarea
            value={overrideNotes}
            onChange={(e) => setOverrideNotes(e.target.value)}
            placeholder="Notes for override decision..."
            className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleApprove}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
            >
              Approve Override
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            >
              Reject Document
            </button>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs text-gray-400 text-right">
        Analyzed: {formatTimestamp(result.analysisTimestamp)}
      </div>
    </div>
  );
};

export default OscarAnalysisPanel;
