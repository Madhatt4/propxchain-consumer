// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { Transaction } from '../types/transaction.types';
import { logger } from '@/utils/logger';

interface ChainProperty {
  id: string;
  anonymousId: string;
  isUserProperty: boolean;
  address?: string; // Only shown for user's property
  status: string;
  progressPercentage: number;
  milestones: {
    documents: 'complete' | 'in-progress' | 'pending';
    searches: 'complete' | 'in-progress' | 'pending';
    financing: 'complete' | 'in-progress' | 'pending';
  };
  nextProperty?: ChainProperty; // Buyer's property (next in chain)
  role: 'selling' | 'buying'; // What this property is doing relative to user
}

interface ChainViewProps {
  transactionId: string;
  userPrincipal: string;
}

const ChainView: React.FC<ChainViewProps> = ({ transactionId, userPrincipal }) => {
  const themeClasses = useThemeClasses();
  const [chainData, setChainData] = useState<ChainProperty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([transactionId]));

  useEffect(() => {
    loadChainData();
  }, [transactionId, userPrincipal]);

  const loadChainData = () => {
    setIsLoading(true);

    try {
      // Load all transactions
      const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');

      // Find the user's transaction (case-insensitive)
      const userTransaction = allTransactions.find((tx: Transaction) =>
        tx.id.toLowerCase() === transactionId.toLowerCase()
      );

      if (!userTransaction) {
        logger.error('Transaction not found');
        setIsLoading(false);
        return;
      }

      // Build chain data starting from user's property
      const chain = buildChainFromTransaction(userTransaction, allTransactions, userPrincipal, true);
      setChainData(chain);
    } catch (error) {
      logger.error('Error loading chain data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildChainFromTransaction = (
    transaction: Transaction,
    allTransactions: Transaction[],
    userPrincipal: string,
    isUserProperty: boolean = false
  ): ChainProperty => {
    // Calculate progress based on milestones
    const completedMilestones = transaction.milestones?.filter(m => m.status === 'completed').length || 0;
    const totalMilestones = transaction.milestones?.length || 8;
    const progressPercentage = Math.round((completedMilestones / totalMilestones) * 100);

    // Determine milestone statuses
    const documentsMilestone = transaction.milestones?.find(m => m.name === 'Documents Collected');
    const searchesMilestone = transaction.milestones?.find(m => m.name === 'Searches Completed');
    const exchangeMilestone = transaction.milestones?.find(m => m.name === 'Contract Exchange');

    const getStatus = (milestone: any): 'complete' | 'in-progress' | 'pending' => {
      if (!milestone) return 'pending';
      if (milestone.status === 'completed') return 'complete';
      if (milestone.status === 'in-progress') return 'in-progress';
      return 'pending';
    };

    // Generate anonymous ID from transaction ID
    const anonymousId = `Property #${transaction.id.split('-').slice(1).join('')}`;

    // Build the property object
    const property: ChainProperty = {
      id: transaction.id,
      anonymousId,
      isUserProperty,
      address: isUserProperty ? transaction.propertyAddress : undefined,
      status: getTransactionStatusText(transaction.status, progressPercentage),
      progressPercentage,
      milestones: {
        documents: getStatus(documentsMilestone),
        searches: getStatus(searchesMilestone),
        financing: getStatus(exchangeMilestone),
      },
      role: isUserProperty ? 'selling' : 'buying',
    };

    // Find buyer's transaction (next in chain)
    // In a real implementation, this would be stored in the transaction data
    // For now, we'll create mock chain data if it's the user's property
    if (isUserProperty && transaction.wizardData?.hasBuyer) {
      // Mock buyer transaction
      const buyerId = `TX-B${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const buyerTx: Partial<Transaction> = {
        id: buyerId,
        propertyAddress: 'Anonymous Property',
        status: 'active',
        milestones: [
          { id: 'docs', name: 'Documents Collected', status: 'completed', description: '', order: 1 },
          { id: 'searches', name: 'Searches Completed', status: 'in-progress', description: '', order: 2 },
          { id: 'exchange', name: 'Contract Exchange', status: 'pending', description: '', order: 3 },
        ],
      };

      property.nextProperty = buildChainFromTransaction(
        buyerTx as Transaction,
        allTransactions,
        userPrincipal,
        false
      );

      // Add buyer's buyer (chain continuation)
      if (property.nextProperty) {
        const buyerBuyerId = `TX-C${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const buyerBuyerTx: Partial<Transaction> = {
          id: buyerBuyerId,
          propertyAddress: 'Anonymous Property',
          status: 'active',
          milestones: [
            { id: 'docs', name: 'Documents Collected', status: 'in-progress', description: '', order: 1 },
            { id: 'searches', name: 'Searches Completed', status: 'pending', description: '', order: 2 },
            { id: 'exchange', name: 'Contract Exchange', status: 'pending', description: '', order: 3 },
          ],
        };

        property.nextProperty.nextProperty = buildChainFromTransaction(
          buyerBuyerTx as Transaction,
          allTransactions,
          userPrincipal,
          false
        );

        // Bottom of chain
        if (property.nextProperty.nextProperty) {
          const bottomId = `TX-D${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const bottomTx: Partial<Transaction> = {
            id: bottomId,
            propertyAddress: 'Anonymous Property',
            status: 'active',
            milestones: [
              { id: 'docs', name: 'Documents Collected', status: 'completed', description: '', order: 1 },
              { id: 'searches', name: 'Searches Completed', status: 'completed', description: '', order: 2 },
              { id: 'exchange', name: 'Contract Exchange', status: 'pending', description: '', order: 3 },
            ],
          };

          property.nextProperty.nextProperty.nextProperty = buildChainFromTransaction(
            bottomTx as Transaction,
            allTransactions,
            userPrincipal,
            false
          );
        }
      }
    }

    return property;
  };

  const getTransactionStatusText = (_status: string, progress: number): string => {
    if (progress >= 90) return 'Ready to Exchange';
    if (progress >= 75) return 'Mortgage Approved';
    if (progress >= 60) return 'Survey Pending';
    if (progress >= 40) return 'Searches In Progress';
    return 'Document Collection';
  };


  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const renderProperty = (property: ChainProperty, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(property.id);
    const hasChildren = !!property.nextProperty;

    return (
      <div key={property.id} className="mb-2">
        <div
          className={`${themeClasses.cardSecondary} rounded-lg p-4 hover:${themeClasses.borderHover} transition-colors ${
            property.isUserProperty ? 'border-2 border-gray-400 dark:border-gray-500' : 'border border-gray-300 dark:border-gray-600'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Property Header */}
              <div className="flex items-center mb-2">
                {hasChildren && (
                  <button
                    onClick={() => toggleNode(property.id)}
                    className={`mr-2 ${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`}
                  >
                    <svg
                      className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <h4 className={`text-lg font-bold ${themeClasses.textPrimary}`}>
                  {property.isUserProperty ? 'YOUR PROPERTY' : property.anonymousId}
                  {property.isUserProperty && (
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">(Your Sale)</span>
                  )}
                  {!property.isUserProperty && property.nextProperty && (
                    <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">(Buying from you)</span>
                  )}
                </h4>
              </div>

              {/* Address (only for user's property) */}
              {property.isUserProperty && property.address && (
                <p className={`text-sm ${themeClasses.textSecondary} mb-2`}>{property.address}</p>
              )}

              {/* Status Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  property.progressPercentage >= 85 ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' :
                  property.progressPercentage >= 50 ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' :
                  'bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30'
                }`}>
                  {property.status}
                </span>
                <span className={`ml-auto text-lg font-bold ${
                  property.progressPercentage >= 85 ? 'text-green-700 dark:text-green-400' :
                  property.progressPercentage >= 50 ? 'text-yellow-700 dark:text-yellow-400' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {property.progressPercentage}%
                </span>
              </div>

              {/* Vertical Timeline Progress */}
              <div className="space-y-0">
                {[
                  { key: 'documents', label: 'Documents', status: property.milestones.documents, percentage: property.milestones.documents === 'complete' ? 100 : property.milestones.documents === 'in-progress' ? 50 : 0 },
                  { key: 'searches', label: 'Searches & Surveys', status: property.milestones.searches, percentage: property.milestones.searches === 'complete' ? 100 : property.milestones.searches === 'in-progress' ? 45 : 0 },
                  { key: 'financing', label: 'Financing', status: property.milestones.financing, percentage: property.milestones.financing === 'complete' ? 100 : property.milestones.financing === 'in-progress' ? 30 : 0 },
                ].map((milestone, index, arr) => (
                  <div key={milestone.key} className="flex items-start gap-3 relative">
                    {/* Vertical connecting line */}
                    {index < arr.length - 1 && (
                      <div
                        className={`absolute left-[15px] top-8 w-0.5 h-8 ${
                          milestone.status === 'complete' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    )}

                    {/* Circle indicator */}
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        milestone.status === 'complete'
                          ? 'bg-green-500 text-white'
                          : milestone.status === 'in-progress'
                          ? 'bg-gray-700 border-2 border-gray-500 text-white'
                          : 'bg-gray-100 border-2 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600'
                      }`}
                    >
                      {milestone.status === 'complete' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>

                    {/* Label and percentage */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          milestone.status === 'complete' || milestone.status === 'in-progress'
                            ? themeClasses.textPrimary
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {milestone.label}
                        </span>
                        {milestone.status === 'in-progress' && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Current
                          </span>
                        )}
                      </div>
                      <span className={`text-xs ${
                        milestone.status === 'complete' ? 'text-green-700 dark:text-green-400' :
                        milestone.status === 'in-progress' ? 'text-yellow-700 dark:text-yellow-400' :
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {milestone.percentage}% complete
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Child properties (buyers) */}
        {hasChildren && isExpanded && (
          <div className="ml-8 mt-2 border-l-2 border-gray-300 dark:border-gray-600 pl-4">
            <div className="relative">
              <div className="absolute -left-5 top-4 w-4 h-0.5 bg-gray-300 dark:bg-gray-600" />
              {renderProperty(property.nextProperty!, depth + 1)}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`${themeClasses.cardBg} rounded-lg p-8`}>
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-gray-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className={`ml-3 ${themeClasses.textSecondary}`}>Loading chain view...</span>
        </div>
      </div>
    );
  }

  if (!chainData) {
    return (
      <div className={`${themeClasses.cardBg} rounded-lg p-8 text-center`}>
        <p className={themeClasses.textSecondary}>No chain data available</p>
      </div>
    );
  }

  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className={`text-xl font-bold ${themeClasses.textPrimary} mb-1`}>
            Property Chain View
          </h3>
          <p className={`text-sm ${themeClasses.textSecondary}`}>
            GDPR-compliant chain visibility - Full details only for your property
          </p>
        </div>
        <button
          onClick={loadChainData}
          className={`px-3 py-1 text-sm ${themeClasses.cardSecondary} ${themeClasses.textSecondary} rounded hover:opacity-80`}
          title="Refresh chain"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className={`${themeClasses.cardSecondary} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              <span className={themeClasses.textSecondary}>Complete</span>
            </div>
            <div className="flex items-center">
              <span className="text-yellow-400 mr-2">⏳</span>
              <span className={themeClasses.textSecondary}>In Progress</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-500 mr-2">❌</span>
              <span className={themeClasses.textSecondary}>Not Started</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chain Tree */}
      <div className="space-y-2">
        {renderProperty(chainData)}
      </div>

      {/* Footer Info */}
      <div className={`mt-6 p-4 ${themeClasses.cardSecondary} rounded-lg`}>
        <p className={`text-xs ${themeClasses.textTertiary}`}>
          <strong>Privacy Note:</strong> Other properties in the chain are displayed with anonymous IDs only.
          You can see their progress status to understand chain readiness, but personal information is protected.
        </p>
      </div>
    </div>
  );
};

export default ChainView;
