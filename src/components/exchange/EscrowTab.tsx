import React, { useState } from 'react';
import type {
  ExchangeTransaction,
  EscrowConfirmation,
  LenderConfirmation,
} from '../../types/exchange.types';

interface EscrowTabProps {
  transaction: ExchangeTransaction;
  escrowConfirmations: EscrowConfirmation[];
  lenderConfirmation: LenderConfirmation | null;
  onEscrowCodeSubmit: (role: string, code: string) => void;
  onDownloadContract: () => void;
  onInitiateCompletion: () => void;
  isSigning: boolean;
  themeClasses: Record<string, string>;
}

const EscrowTab: React.FC<EscrowTabProps> = ({
  transaction,
  escrowConfirmations,
  lenderConfirmation,
  onEscrowCodeSubmit,
  onDownloadContract,
  onInitiateCompletion,
  isSigning,
  themeClasses,
}) => {
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});

  const allEscrowConfirmed = escrowConfirmations.length > 0 && escrowConfirmations.every(c => c.isConfirmed);
  const lenderOk = !transaction.financialTerms.hasMortgage || (lenderConfirmation?.isConfirmed ?? false);
  const allPaymentConfirmed = allEscrowConfirmed && lenderOk;
  const isExchanged = transaction.status === 'exchanged';
  const canInitiateCompletion = isExchanged && allPaymentConfirmed && transaction.allPartiesSigned;
  const balance = transaction.financialTerms.purchasePrice - transaction.financialTerms.deposit;

  const handleSubmitCode = (role: string): void => {
    const code = codeInputs[role]?.trim().toUpperCase();
    if (!code) {
      setCodeErrors(prev => ({ ...prev, [role]: 'Please enter a code' }));
      return;
    }
    setCodeErrors(prev => ({ ...prev, [role]: '' }));
    onEscrowCodeSubmit(role, code);
    setCodeInputs(prev => ({ ...prev, [role]: '' }));
  };

  return (
    <div className="space-y-6">
      {/* Funds Summary */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Funds Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className={themeClasses.textSecondary}>Purchase Price</span>
            <span className={`font-bold text-lg ${themeClasses.textPrimary}`}>
              {'\u00A3'}{transaction.financialTerms.purchasePrice.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={themeClasses.textSecondary}>Deposit</span>
            <span className={`font-medium ${themeClasses.textPrimary}`}>
              {'\u00A3'}{transaction.financialTerms.deposit.toLocaleString()}
            </span>
          </div>
          <div className={`flex justify-between pt-3 border-t ${themeClasses.border}`}>
            <span className={`font-semibold ${themeClasses.textPrimary}`}>Balance on Completion</span>
            <span className={`font-bold text-lg ${themeClasses.textPrimary}`}>
              {'\u00A3'}{balance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Funds Confirmations */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Payment Confirmations</h3>
        <p className={`text-sm ${themeClasses.textSecondary} mb-4`}>
          Each party confirms their funds are held with the conveyancer by entering their unique confirmation code.
        </p>

        <div className="space-y-4">
          {escrowConfirmations.map((confirmation) => (
            <div key={confirmation.stakeholderRole} className="space-y-2">
              <div className={`flex items-center justify-between p-4 rounded-lg bg-stone-100 dark:bg-gray-700 border border-stone-200 dark:border-gray-600`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    confirmation.isConfirmed ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600'
                  }`}>
                    {confirmation.isConfirmed ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${themeClasses.textPrimary}`}>{confirmation.stakeholderName}</p>
                    <p className={`text-xs ${themeClasses.textSecondary} capitalize`}>{confirmation.stakeholderRole.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  confirmation.isConfirmed
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {confirmation.isConfirmed ? 'Confirmed' : 'Awaiting'}
                </span>
              </div>

              {/* Code Input (if not yet confirmed) */}
              {!confirmation.isConfirmed && (
                <div className="flex space-x-2 pl-11">
                  <input
                    type="text"
                    value={codeInputs[confirmation.stakeholderRole] || ''}
                    onChange={e => setCodeInputs(prev => ({
                      ...prev,
                      [confirmation.stakeholderRole]: e.target.value.toUpperCase()
                    }))}
                    placeholder="Enter code"
                    maxLength={8}
                    className={`flex-1 px-3 py-1.5 rounded border ${themeClasses.border} bg-white dark:bg-gray-700 ${themeClasses.textPrimary} font-mono tracking-widest text-sm`}
                  />
                  <button
                    onClick={() => handleSubmitCode(confirmation.stakeholderRole)}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 transition-colors"
                  >
                    Verify
                  </button>
                </div>
              )}
              {codeErrors[confirmation.stakeholderRole] && (
                <p className="text-red-500 text-xs pl-11">{codeErrors[confirmation.stakeholderRole]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* All Confirmed Banner */}
      {allPaymentConfirmed && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold text-green-800 dark:text-green-300">All Funds Confirmed</p>
              <p className="text-sm text-green-700 dark:text-green-200">
                All payment confirmations received. The transaction is ready for completion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Download Contract */}
      {transaction.allPartiesSigned && (
        <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
          <button
            onClick={onDownloadContract}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download Signed Contract (PDF)</span>
          </button>
        </div>
      )}

      {/* Initiate Completion */}
      {canInitiateCompletion && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">Ready for Completion</h3>
          <p className="text-blue-700 dark:text-blue-200 mb-4 text-sm">
            All signatures collected and funds confirmed. Click below to initiate the blockchain
            completion process, transferring ownership on-chain.
          </p>
          <button
            onClick={onInitiateCompletion}
            disabled={isSigning}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {isSigning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Initiating Completion...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Initiate Blockchain Completion</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default EscrowTab;
