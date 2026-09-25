// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';

interface ConsentStepProps {
  solicitorName: string;
  onComplete: () => void;
  onBack: () => void;
}

const CONSENT_TEXT =
  'By joining this transaction, you consent to your regulatory credentials ' +
  '(SRA/CLC number, verification status), firm details, task activity, and pricing ' +
  'being visible to all transaction parties. Transaction records on the Internet ' +
  'Computer blockchain are permanent.';

const ConsentStep: React.FC<ConsentStepProps> = ({ solicitorName, onComplete, onBack }) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Consent & Data Sharing</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Please read and accept the following before joining.
        </p>
      </div>

      {/* Solicitor identity confirmation */}
      <div className="p-3 bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Joining as</p>
        <p className="text-gray-900 dark:text-white font-semibold text-sm">{solicitorName}</p>
      </div>

      {/* Consent text box */}
      <div className="p-4 bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded-lg">
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{CONSENT_TEXT}</p>
      </div>

      {/* Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-green-500 focus:ring-green-500 focus:ring-offset-white dark:focus:ring-offset-gray-900 cursor-pointer"
        />
        <span className="text-gray-700 dark:text-gray-300 text-sm">
          I have read and agree to the data sharing terms above.
        </span>
      </label>

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
          onClick={onComplete}
          disabled={!accepted}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
            accepted
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
          }`}
        >
          Accept &amp; Join Transaction
        </button>
      </div>
    </div>
  );
};

export default ConsentStep;
