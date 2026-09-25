// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import {
  SOLICITOR_TASK_LABELS,
  TASK_PRICE_MAX_PENCE,
} from '../../types/solicitor.types';
import type { SolicitorTaskType } from '../../types/solicitor.types';

interface PricingEntry {
  taskType: SolicitorTaskType;
  priceGBP: number;
}

interface PricingStepProps {
  onComplete: (pricing: PricingEntry[]) => void;
  onBack: () => void;
}

const TASK_TYPES: SolicitorTaskType[] = ['tr1_preparation', 'ap1_submission', 'identity_certification'];

const MAX_GBP = TASK_PRICE_MAX_PENCE / 100; // 9999

const PricingStep: React.FC<PricingStepProps> = ({ onComplete, onBack }) => {
  const [prices, setPrices] = useState<Record<SolicitorTaskType, string>>({
    tr1_preparation: '',
    ap1_submission: '',
    identity_certification: '',
  });
  const [errors, setErrors] = useState<Record<SolicitorTaskType, string>>({
    tr1_preparation: '',
    ap1_submission: '',
    identity_certification: '',
  });

  const validatePrice = (value: string): string => {
    if (!value.trim()) return 'Price is required.';
    const num = parseFloat(value);
    if (isNaN(num) || !/^\d+(\.\d{0,2})?$/.test(value.trim())) return 'Must be a valid number (e.g. 299.99).';
    if (num < 0) return 'Price cannot be negative.';
    if (num > MAX_GBP) return `Maximum price is £${MAX_GBP.toLocaleString()}.`;
    return '';
  };

  const handleChange = (taskType: SolicitorTaskType, value: string): void => {
    setPrices((prev) => ({ ...prev, [taskType]: value }));
    setErrors((prev) => ({ ...prev, [taskType]: validatePrice(value) }));
  };

  const runningTotalPence = TASK_TYPES.reduce<number>((sum, t) => {
    const v = parseFloat(prices[t]);
    return isNaN(v) ? sum : sum + Math.round(v * 100);
  }, 0);

  const allValid = TASK_TYPES.every((t) => {
    const v = prices[t];
    return v.trim() !== '' && validatePrice(v) === '';
  });

  const handleSubmit = (): void => {
    if (!allValid) return;
    const pricing: PricingEntry[] = TASK_TYPES.map((t) => ({
      taskType: t,
      priceGBP: Math.round(parseFloat(prices[t]) * 100),
    }));
    onComplete(pricing);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Set Your Prices</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Enter your fee for each task. Prices are visible to all transaction parties.
        </p>
      </div>

      {/* Task price cards */}
      <div className="space-y-4">
        {TASK_TYPES.map((taskType) => {
          const label = SOLICITOR_TASK_LABELS[taskType];
          return (
            <div key={taskType} className="p-4 bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg">
              <p className="text-gray-900 dark:text-white text-sm font-semibold mb-1">{label.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">{label.description}</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">£</span>
                <input
                  type="number"
                  min="0"
                  max={MAX_GBP}
                  step="0.01"
                  value={prices[taskType]}
                  onChange={(e) => handleChange(taskType, e.target.value)}
                  placeholder="0.00"
                  className={`flex-1 px-3 py-2 bg-white dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-sm ${
                    errors[taskType] ? 'border-red-600 focus:border-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-blue-500'
                  }`}
                />
              </div>
              {errors[taskType] && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors[taskType]}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Running total */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded-lg">
        <span className="text-gray-600 dark:text-gray-400 text-sm">Total</span>
        <span className="text-gray-900 dark:text-white font-bold text-lg">
          £{(runningTotalPence / 100).toFixed(2)}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 px-4 rounded-lg text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-sm"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allValid}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
            allValid
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PricingStep;
