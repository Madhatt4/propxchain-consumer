import React, { useState } from 'react';
import type { ExchangeTransaction, LenderConfirmation } from '../../types/exchange.types';

interface LenderTabProps {
  transaction: ExchangeTransaction;
  lenderConfirmation: LenderConfirmation | null;
  onConfirmationCodeSubmit: (code: string) => void;
  themeClasses: Record<string, string>;
}

const LenderTab: React.FC<LenderTabProps> = ({
  transaction,
  lenderConfirmation,
  onConfirmationCodeSubmit,
  themeClasses,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const { financialTerms } = transaction;
  const hasMortgage = financialTerms.hasMortgage !== false;

  const handleSubmitCode = (): void => {
    if (!codeInput.trim()) {
      setCodeError('Please enter a confirmation code');
      return;
    }
    setCodeError('');
    onConfirmationCodeSubmit(codeInput.trim().toUpperCase());
    setCodeInput('');
  };

  if (!hasMortgage) {
    return (
      <div className="space-y-6">
        <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-2`}>Cash Purchase</h3>
            <p className={`${themeClasses.textSecondary}`}>
              No mortgage lender is involved in this transaction.
              The buyer is purchasing with cash funds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mortgage Details */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Mortgage Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className={themeClasses.textSecondary}>Purchase Price</span>
            <span className={`font-medium ${themeClasses.textPrimary}`}>
              {'\u00A3'}{financialTerms.purchasePrice.toLocaleString()}
            </span>
          </div>
          {financialTerms.mortgageAmount && (
            <div className="flex justify-between">
              <span className={themeClasses.textSecondary}>Mortgage Amount</span>
              <span className={`font-medium ${themeClasses.textPrimary}`}>
                {'\u00A3'}{financialTerms.mortgageAmount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className={themeClasses.textSecondary}>Deposit</span>
            <span className={`font-medium ${themeClasses.textPrimary}`}>
              {'\u00A3'}{financialTerms.deposit.toLocaleString()}
            </span>
          </div>
          {financialTerms.lenderName && (
            <div className="flex justify-between">
              <span className={themeClasses.textSecondary}>Lender</span>
              <span className={`font-medium ${themeClasses.textPrimary}`}>{financialTerms.lenderName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lender Confirmation Status */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Lender Confirmation</h3>

        <div className="space-y-4">
          {/* Mortgage Advance Ready */}
          <div className={`flex items-center justify-between p-3 rounded-lg bg-stone-100 dark:bg-gray-700`}>
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                lenderConfirmation?.mortgageAdvanceReady
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}>
                {lenderConfirmation?.mortgageAdvanceReady ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm text-gray-400">1</span>
                )}
              </div>
              <span className={themeClasses.textPrimary}>Mortgage Advance Ready</span>
            </div>
            <span className={`text-sm ${lenderConfirmation?.mortgageAdvanceReady ? 'text-green-600 dark:text-green-400' : themeClasses.textSecondary}`}>
              {lenderConfirmation?.mortgageAdvanceReady ? 'Confirmed' : 'Pending'}
            </span>
          </div>

          {/* Discharge Consent */}
          <div className={`flex items-center justify-between p-3 rounded-lg bg-stone-100 dark:bg-gray-700`}>
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                lenderConfirmation?.dischargeConsentGiven
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}>
                {lenderConfirmation?.dischargeConsentGiven ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm text-gray-400">2</span>
                )}
              </div>
              <span className={themeClasses.textPrimary}>Discharge Consent (existing mortgage)</span>
            </div>
            <span className={`text-sm ${lenderConfirmation?.dischargeConsentGiven ? 'text-green-600 dark:text-green-400' : themeClasses.textSecondary}`}>
              {lenderConfirmation?.dischargeConsentGiven ? 'Confirmed' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Code Entry */}
      {!lenderConfirmation?.isConfirmed && (
        <div className={`${themeClasses.cardBg} rounded-lg p-6 border-2 border-blue-200 dark:border-blue-700`}>
          <h4 className={`font-semibold ${themeClasses.textPrimary} mb-2`}>Enter Lender Confirmation Code</h4>
          <p className={`text-sm ${themeClasses.textSecondary} mb-4`}>
            The mortgage lender should provide a confirmation code once the mortgage advance is ready
            and any existing charges have been discharged.
          </p>
          <div className="flex space-x-3">
            <input
              type="text"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. ABCD1234"
              maxLength={8}
              className={`flex-1 px-4 py-2 rounded-lg border ${themeClasses.border} bg-white dark:bg-gray-700 ${themeClasses.textPrimary} font-mono text-lg tracking-widest text-center`}
            />
            <button
              onClick={handleSubmitCode}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Verify
            </button>
          </div>
          {codeError && <p className="text-red-500 text-sm mt-2">{codeError}</p>}
        </div>
      )}

      {/* Confirmed Banner */}
      {lenderConfirmation?.isConfirmed && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300">Lender Confirmed</p>
              <p className="text-sm text-green-700 dark:text-green-200">
                Confirmed at {new Date(lenderConfirmation.confirmedAt || '').toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LenderTab;
