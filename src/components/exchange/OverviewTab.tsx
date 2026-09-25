import React from 'react';
import ExchangeProgressTracker from './ExchangeProgressTracker';
import type {
  ExchangeTransaction,
  EscrowConfirmation,
  LenderConfirmation,
} from '../../types/exchange.types';

interface OverviewTabProps {
  transaction: ExchangeTransaction;
  escrowConfirmations: EscrowConfirmation[];
  lenderConfirmation: LenderConfirmation | null;
  themeClasses: Record<string, string>;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  transaction,
  escrowConfirmations,
  lenderConfirmation,
  themeClasses,
}) => {
  const isExchanged = transaction.status === 'exchanged' ||
    transaction.status === 'completion_initiated' ||
    transaction.status === 'blockchain_completed';
  const isCompleting = transaction.status === 'completion_initiated';

  return (
    <div className="space-y-6">
      {/* Progress Tracker */}
      <ExchangeProgressTracker
        transaction={transaction}
        escrowConfirmations={escrowConfirmations}
        lenderConfirmation={lenderConfirmation}
        themeClasses={themeClasses}
      />

      {/* Exchange Status Banner */}
      {isExchanged && transaction.exchangeTimestamp && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-300">Contract Exchanged!</h3>
              <p className="text-green-800 dark:text-green-200">
                Exchanged on: {new Date(transaction.exchangeTimestamp * 1000).toLocaleString()}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Contract Hash: <code className="font-mono text-xs">{transaction.contractHash}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {isCompleting && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300">Completion in Progress</h3>
              <p className="text-purple-700 dark:text-purple-200">
                Ownership transfer is being processed on-chain.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Summary */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Transaction Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Property</p>
            <p className={`font-medium ${themeClasses.textPrimary}`}>{transaction.propertyAddress}</p>
          </div>
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Title Number</p>
            <p className={`font-medium ${themeClasses.textPrimary}`}>{transaction.titleNumber}</p>
          </div>
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Transaction ID</p>
            <p className={`font-mono text-sm ${themeClasses.textPrimary}`}>{transaction.id}</p>
          </div>
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Property Type</p>
            <p className={`font-medium ${themeClasses.textPrimary}`}>{transaction.propertyType}</p>
          </div>
        </div>
      </div>

      {/* Financial Terms */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Financial Terms</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Purchase Price</p>
            <p className={`text-xl font-bold ${themeClasses.textPrimary}`}>
              {'\u00A3'}{transaction.financialTerms.purchasePrice.toLocaleString()}
            </p>
          </div>
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Deposit</p>
            <p className={`text-xl font-bold ${themeClasses.textPrimary}`}>
              {'\u00A3'}{transaction.financialTerms.deposit.toLocaleString()}
            </p>
          </div>
          <div>
            <p className={`text-sm ${themeClasses.textSecondary}`}>Completion Date</p>
            <p className={`text-xl font-bold ${themeClasses.textPrimary}`}>
              {new Date(transaction.financialTerms.completionDate).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
      </div>

      {/* Blockchain Info */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h4 className={`font-semibold ${themeClasses.textPrimary} mb-3`}>About This Exchange</h4>
        <div className={`space-y-2 text-sm ${themeClasses.textSecondary}`}>
          <p>{'\u2713'} Recorded on the Internet Computer blockchain</p>
          <p>{'\u2713'} PropXchain pays all blockchain fees - no wallet required</p>
          <p>{'\u2713'} Signatures are cryptographically secured and immutable</p>
          <p>{'\u2713'} Once all parties sign, the exchange is legally binding</p>
          <p>{'\u2713'} Contract hash provides proof of the exact terms agreed</p>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
