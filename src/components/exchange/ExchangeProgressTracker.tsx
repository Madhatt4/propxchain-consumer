import React from 'react';
import type {
  ExchangeTransaction,
  EscrowConfirmation,
  LenderConfirmation,
  ProgressStep,
} from '../../types/exchange.types';

interface ExchangeProgressTrackerProps {
  transaction: ExchangeTransaction;
  escrowConfirmations: EscrowConfirmation[];
  lenderConfirmation: LenderConfirmation | null;
  themeClasses: Record<string, string>;
}

function deriveSteps(
  tx: ExchangeTransaction,
  escrow: EscrowConfirmation[],
  lender: LenderConfirmation | null
): ProgressStep[] {
  const sellerSigned = tx.sellerSigned;
  const buyerSigned = tx.buyerSigned;
  const allSigned = tx.allPartiesSigned || (sellerSigned && buyerSigned);
  const escrowConfirmed = escrow.length > 0 && escrow.every(c => c.isConfirmed);
  const lenderConfirmed = !tx.financialTerms.hasMortgage || (lender?.isConfirmed ?? false);
  const paymentConfirmed = escrowConfirmed && lenderConfirmed;
  const isExchanged = tx.status === 'exchanged' || tx.status === 'completion_initiated' ||
    tx.status === 'blockchain_completed' || tx.status === 'land_registry_registered';
  const isCompleting = tx.status === 'completion_initiated' ||
    tx.status === 'blockchain_completed' || tx.status === 'land_registry_registered';
  const isRegistered = tx.status === 'land_registry_registered';

  const steps: ProgressStep[] = [
    { id: 'docs', label: 'Documents', isComplete: true, isActive: false },
    { id: 'seller_sign', label: 'Seller Signed', isComplete: sellerSigned, isActive: !sellerSigned },
    { id: 'buyer_sign', label: 'Buyer Signed', isComplete: buyerSigned, isActive: sellerSigned && !buyerSigned },
    { id: 'solicitors', label: 'Solicitors', isComplete: allSigned, isActive: false },
    { id: 'payment', label: 'Payment', isComplete: paymentConfirmed, isActive: allSigned && !paymentConfirmed },
    { id: 'exchanged', label: 'Exchanged', isComplete: isExchanged, isActive: paymentConfirmed && !isExchanged },
    { id: 'completion', label: 'Completion', isComplete: isCompleting, isActive: isExchanged && !isCompleting },
    { id: 'registered', label: 'Registered', isComplete: isRegistered, isActive: isCompleting && !isRegistered },
  ];

  return steps;
}

const ExchangeProgressTracker: React.FC<ExchangeProgressTrackerProps> = ({
  transaction,
  escrowConfirmations,
  lenderConfirmation,
  themeClasses,
}) => {
  const steps = deriveSteps(transaction, escrowConfirmations, lenderConfirmation);

  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-6 mb-6`}>
      <h3 className={`text-sm font-semibold ${themeClasses.textSecondary} uppercase tracking-wide mb-4`}>
        Exchange Progress
      </h3>
      <div className="flex items-center justify-between overflow-x-auto">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center min-w-[70px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  step.isComplete
                    ? 'bg-green-500 border-green-500 text-white'
                    : step.isActive
                    ? 'bg-transparent border-blue-500 text-blue-500'
                    : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.isComplete ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-xs mt-1 text-center leading-tight ${
                  step.isComplete
                    ? 'text-green-600 dark:text-green-400 font-medium'
                    : step.isActive
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : themeClasses.textSecondary
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 ${
                  step.isComplete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ExchangeProgressTracker;
