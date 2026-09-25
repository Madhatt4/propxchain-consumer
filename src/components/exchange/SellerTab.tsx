import React from 'react';
import type { ExchangeTransaction, CurrentUser } from '../../types/exchange.types';

interface SellerTabProps {
  transaction: ExchangeTransaction;
  currentUser: CurrentUser | null;
  isSigning: boolean;
  onOpenSignatureModal: () => void;
  themeClasses: Record<string, string>;
}

const SellerTab: React.FC<SellerTabProps> = ({
  transaction,
  currentUser,
  isSigning,
  onOpenSignatureModal,
  themeClasses,
}) => {
  const sellerParty = transaction.parties.find(p => p.role === 'seller');
  const buyerParty = transaction.parties.find(p => p.role === 'buyer');

  // Match by principal (userId = principalId from canister)
  const isCurrentUserSeller = !!(currentUser && sellerParty && sellerParty.userId === currentUser.id);

  // Allow signing when: user is seller, hasn't signed yet, and status allows it
  const canSign = isCurrentUserSeller && !sellerParty?.hasSigned &&
    ['readyForExchange', 'active', 'pending', 'ready_for_exchange'].includes(transaction.status);

  return (
    <div className="space-y-6">
      {/* Seller Status Card */}
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Seller</h3>

        <div className={`flex items-center justify-between p-4 rounded-lg bg-stone-100 dark:bg-gray-700 border border-stone-200 dark:border-gray-600`}>
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              sellerParty?.hasSigned
                ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500'
                : 'bg-stone-200 dark:bg-gray-600'
            }`}>
              {sellerParty?.hasSigned ? (
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <p className={`font-medium ${themeClasses.textPrimary}`}>
                {sellerParty?.name || 'Seller'} {isCurrentUserSeller && '(You)'}
              </p>
              <p className={`text-sm ${themeClasses.textSecondary}`}>
                {sellerParty?.hasSigned
                  ? `Signed${sellerParty.signedAt && sellerParty.signedAt !== 'On-chain' ? ` on ${new Date(sellerParty.signedAt).toLocaleString()}` : ' — recorded on blockchain'}`
                  : 'Awaiting signature'}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
            sellerParty?.hasSigned
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-amber-100 text-amber-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {sellerParty?.hasSigned ? 'Signed' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Signature Hash Preview (if signed) */}
      {sellerParty?.hasSigned && sellerParty.signature && (
        <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
          <h4 className={`font-semibold ${themeClasses.textPrimary} mb-3`}>Seller Signature</h4>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
            <div className="flex items-center space-x-2 text-green-700 dark:text-green-300 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-medium">Verified on blockchain</span>
            </div>
            <p className={`text-xs font-mono ${themeClasses.textSecondary}`}>
              Hash: {sellerParty.signature.substring(0, 32)}...
            </p>
          </div>
        </div>
      )}

      {/* Sign Button */}
      {canSign && (
        <div className={`${themeClasses.cardBg} rounded-lg p-6 border-2 border-indigo-200 dark:border-indigo-700`}>
          <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-3`}>
            Ready to Sign
          </h3>
          <p className={`${themeClasses.textSecondary} mb-4 text-sm`}>
            By signing, you agree to the terms of the property exchange contract.
            Your signature will be recorded on the Internet Computer blockchain.
          </p>
          {buyerParty?.hasSigned && (
            <p className="text-green-600 dark:text-green-400 text-sm mb-4 font-medium">
              The buyer has already signed. Your signature will complete the exchange.
            </p>
          )}
          <button
            onClick={onOpenSignatureModal}
            disabled={isSigning}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {isSigning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Signing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Sign Contract as Seller</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* What Happens When You Sign */}
      {!sellerParty?.hasSigned && (
        <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
          <h4 className={`font-semibold ${themeClasses.textPrimary} mb-3`}>What happens when you sign?</h4>
          <ul className={`space-y-2 text-sm ${themeClasses.textSecondary}`}>
            <li>1. Your signature is captured and a cryptographic hash is generated</li>
            <li>2. The hash is recorded on the Internet Computer blockchain</li>
            <li>3. Once both seller and buyer sign, the exchange is legally binding</li>
            <li>4. Your conveyancer then confirms funds before completion</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SellerTab;
