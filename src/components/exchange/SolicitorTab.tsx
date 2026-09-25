import React from 'react';
import type { ExchangeTransaction, CurrentUser } from '../../types/exchange.types';

interface SolicitorTabProps {
  transaction: ExchangeTransaction;
  currentUser: CurrentUser | null;
  themeClasses: Record<string, string>;
}

const SolicitorTab: React.FC<SolicitorTabProps> = ({
  transaction,
  currentUser,
  themeClasses,
}) => {
  const solicitorParties = transaction.parties.filter(
    p => p.role === 'solicitor' || p.role === 'sellerSolicitor' || p.role === 'buyerSolicitor'
  );
  const sellerSolicitor = solicitorParties.find(p => p.role === 'sellerSolicitor') || solicitorParties[0];
  const buyerSolicitor = solicitorParties.find(p => p.role === 'buyerSolicitor') || solicitorParties[1];
  const hasSolicitors = solicitorParties.length > 0;
  const isCurrentUserSolicitor = currentUser && solicitorParties.some(p => p.userId === currentUser.id);

  const renderSolicitorCard = (
    solicitor: typeof sellerSolicitor | undefined,
    label: string
  ): React.ReactNode => {
    if (!solicitor) {
      return (
        <div className={`p-4 rounded-lg bg-stone-100 dark:bg-gray-700 border border-stone-200 dark:border-gray-600`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-gray-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className={`font-medium ${themeClasses.textPrimary}`}>{label}</p>
              <p className={`text-sm ${themeClasses.textSecondary}`}>Not yet assigned</p>
            </div>
          </div>
        </div>
      );
    }

    const isSelf = currentUser && solicitor.userId === currentUser.id;

    return (
      <div className={`p-4 rounded-lg bg-stone-100 dark:bg-gray-700 border border-stone-200 dark:border-gray-600`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              solicitor.verified
                ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500'
                : 'bg-stone-200 dark:bg-gray-600'
            }`}>
              <svg className={`w-5 h-5 ${solicitor.verified ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <p className={`font-medium ${themeClasses.textPrimary}`}>
                {solicitor.name} {isSelf && '(You)'}
              </p>
              <p className={`text-sm ${themeClasses.textSecondary}`}>{label}</p>
              {solicitor.email && (
                <p className={`text-xs ${themeClasses.textSecondary}`}>{solicitor.email}</p>
              )}
            </div>
          </div>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            solicitor.verified
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-amber-100 text-amber-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {solicitor.verified ? 'Verified' : 'Pending'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
        <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Legal Representatives</h3>

        {!hasSolicitors ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            <p className={`font-medium ${themeClasses.textPrimary} mb-1`}>No Solicitors Assigned</p>
            <p className={`text-sm ${themeClasses.textSecondary}`}>
              This is a DIY transaction. Solicitors can be invited from the dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {renderSolicitorCard(sellerSolicitor, "Seller's Solicitor")}
            {renderSolicitorCard(buyerSolicitor, "Buyer's Solicitor")}
          </div>
        )}
      </div>

      {/* Solicitor Role Info */}
      {isCurrentUserSolicitor && (
        <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
          <h4 className={`font-semibold ${themeClasses.textPrimary} mb-3`}>Your Responsibilities</h4>
          <ul className={`space-y-2 text-sm ${themeClasses.textSecondary}`}>
            <li>{'\u2022'} Review all contract terms before exchange</li>
            <li>{'\u2022'} Confirm completion of due diligence searches</li>
            <li>{'\u2022'} Verify client identity and source of funds</li>
            <li>{'\u2022'} Coordinate with the other party's solicitor</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SolicitorTab;
