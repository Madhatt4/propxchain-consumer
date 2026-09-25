// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useThemeClasses } from '../../hooks/useThemeClasses';

interface TimelineStep {
  label: string;
  status: 'completed' | 'active' | 'pending';
  sublabel?: string;
}

interface TransactionProgressTimelineProps {
  steps: TimelineStep[];
  propertyAddress: string;
  completionPercentage: number;
  estimatedDays: number;
  isReadyToSign: boolean;
  onSignContract?: () => void;
  onViewProgress?: () => void;
}

const TransactionProgressTimeline: React.FC<TransactionProgressTimelineProps> = ({
  steps,
  propertyAddress,
  completionPercentage,
  estimatedDays,
  isReadyToSign,
  onSignContract,
  onViewProgress
}) => {
  const themeClasses = useThemeClasses();
  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-3 sm:p-6`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h3 className={`text-base sm:text-lg font-semibold ${themeClasses.textPrimary} mb-1`}>Transaction Progress - {propertyAddress}</h3>
          <p className={`text-xs sm:text-sm ${themeClasses.textSecondary}`}>
            {isReadyToSign ? 'Ready for Contract Exchange' : 'Smart Contract Active'}
          </p>
        </div>
        <button
          onClick={isReadyToSign ? onSignContract : onViewProgress}
          className={`px-3 sm:px-4 py-2 text-white text-xs sm:text-sm rounded-lg transition-colors w-full sm:w-auto ${
            isReadyToSign
              ? 'bg-green-600 hover:bg-green-700 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isReadyToSign ? '✓ Sign Contract' : 'View Progress'}
        </button>
      </div>

      {/* Progress Steps - Horizontal on md+, Vertical on mobile */}
      <div className="relative mb-6">
        {/* Desktop/Tablet: Horizontal Layout */}
        <div className="hidden sm:flex justify-between items-center">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center flex-1 relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-0.5 ${
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}

              {/* Step Circle */}
              <div
                className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${
                  step.status === 'completed' ? 'bg-green-500 border-green-500' :
                  step.status === 'active' ? 'bg-gray-600 border-gray-500' :
                  'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                }`}
              >
                {step.status === 'completed' ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === 'active' ? (
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                ) : (
                  <div className="w-3 h-3 bg-gray-500 rounded-full" />
                )}
              </div>

              {/* Step Label */}
              <div className="text-center">
                <p className={`text-xs md:text-sm font-medium ${
                  step.status === 'completed' || step.status === 'active' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step.label}
                </p>
                {step.sublabel && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{step.sublabel}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Vertical Layout */}
        <div className="sm:hidden space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3 relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`absolute left-4 top-10 w-0.5 h-full ${
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}

              {/* Step Circle */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  step.status === 'completed' ? 'bg-green-500 border-green-500' :
                  step.status === 'active' ? 'bg-gray-600 border-gray-500' :
                  'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                }`}
              >
                {step.status === 'completed' ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === 'active' ? (
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                ) : (
                  <div className="w-2.5 h-2.5 bg-gray-500 rounded-full" />
                )}
              </div>

              {/* Step Label */}
              <div className="flex-1 pt-0.5">
                <p className={`text-xs font-medium ${
                  step.status === 'completed' || step.status === 'active' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={`${themeClasses.progressBarTrack} rounded-full h-2 mb-2`}>
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
        {completionPercentage}% Complete - Estimated completion: {estimatedDays} days
      </p>
    </div>
  );
};

export default TransactionProgressTimeline;
