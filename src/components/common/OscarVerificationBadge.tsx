// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';

export type OscarVerificationStatus =
  | 'verified'
  | 'review_needed'
  | 'rejected'
  | 'pending'
  | 'timeout';

interface OscarVerificationBadgeProps {
  status: OscarVerificationStatus;
  confidence?: number;
  issueCount?: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  icon: string;
  label: string;
}

const STATUS_CONFIG: Record<OscarVerificationStatus, StatusConfig> = {
  verified: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: '\u2713', // checkmark
    label: 'Oscar Verified'
  },
  review_needed: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    icon: '\u26A0', // warning
    label: 'Review Needed'
  },
  rejected: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: '\u2717', // X mark
    label: 'Issues Found'
  },
  pending: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
    icon: '\u25CB', // circle
    label: 'Pending'
  },
  timeout: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-200',
    icon: '\u23F1', // timer
    label: 'Analysis Timeout'
  }
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};

const OscarVerificationBadge: React.FC<OscarVerificationBadgeProps> = ({
  status,
  confidence,
  issueCount,
  onClick,
  size = 'md'
}) => {
  const config = STATUS_CONFIG[status];
  const sizeClass = SIZE_CLASSES[size];

  const handleClick = (): void => {
    if (onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClass} ${onClick ? 'cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Oscar verification status: ${config.label}${confidence !== undefined ? `, ${confidence}% confidence` : ''}${issueCount ? `, ${issueCount} issues` : ''}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className="font-medium">{config.label}</span>
      {confidence !== undefined && status !== 'pending' && (
        <span className="opacity-75">({confidence}%)</span>
      )}
      {issueCount !== undefined && issueCount > 0 && (
        <span
          className={`ml-1 px-1.5 rounded-full ${
            status === 'rejected' ? 'bg-red-200' : 'bg-yellow-200'
          }`}
        >
          {issueCount}
        </span>
      )}
    </span>
  );
};

export default OscarVerificationBadge;
