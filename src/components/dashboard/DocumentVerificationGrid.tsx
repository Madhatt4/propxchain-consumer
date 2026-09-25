// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useThemeClasses } from '../../hooks/useThemeClasses';

interface DocumentItem {
  name: string;
  status: 'pending' | 'verified' | 'failed';
}

interface DocumentVerificationGridProps {
  documents: DocumentItem[];
}

const DocumentVerificationGrid: React.FC<DocumentVerificationGridProps> = ({ documents }) => {
  const themeClasses = useThemeClasses();
  const getStatusIcon = (status: string) => {
    if (status === 'verified') {
      return (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    } else if (status === 'pending') {
      return (
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'verified') return 'border-green-500';
    if (status === 'pending') return 'border-gray-500';
    return 'border-red-500';
  };

  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-3 sm:p-6`}>
      <h3 className={`text-base sm:text-lg font-semibold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>Document Verification</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
        {documents.map((doc, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 sm:p-4 ${themeClasses.cardSecondary} rounded-lg border-l-4 ${getStatusColor(doc.status)}`}
          >
            <span className={`text-xs sm:text-sm ${themeClasses.textSecondary} truncate pr-2`}>{doc.name}</span>
            <div className="flex-shrink-0">
              {getStatusIcon(doc.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentVerificationGrid;
