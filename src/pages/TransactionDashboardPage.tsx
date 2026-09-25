import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSidebar from '../components/navigation/DashboardSidebar';
import DashboardHeader from '../components/navigation/DashboardHeader';
import { icpService } from '../services/icp.service';
import { logger } from '@/utils/logger';
import { usePrincipalId, useIsAuthenticated } from '../stores/authStore';
import { isAtLeastStatus, type TransactionStatus } from '@/types/transactionStatus';

interface Transaction {
  id: string | number;
  propertyAddress: string;
  transactionType: string;
  status: string;
  amount?: number;
  createdAt: string | number;
  mode?: string;
  milestones?: any[];
  buyer?: string;
  seller?: string;
  createdBy?: string;
  accessList?: string[];
  buyerSignedAt?: string | number | null;
  sellerSignedAt?: string | number | null;
  completionDate?: string;
}

interface Milestone {
  id: number;
  label: string;
  status: 'complete' | 'in_progress' | 'pending';
  timestamp?: string;
}

/** Derive the 17-step milestone list from transaction status and available data */
function deriveMilestones(tx: Transaction): Milestone[] {
  const ANON = '2vxsx-fae';
  const status = tx.status || '';
  const hasBuyer = Boolean(tx.buyer && tx.buyer !== ANON && tx.buyer !== '');
  const hasSeller = Boolean(tx.seller && tx.seller !== ANON && tx.seller !== '');

  // The chain knows five states; the pre-exchange steps below have no status
  // of their own, so they show as in progress while active and done once
  // exchanged, exactly as the old eleven-value ladder resolved for real data.
  const isAtLeast = (s: TransactionStatus): boolean => isAtLeastStatus(status, s);
  const exchanged = isAtLeast('exchanged');
  const preExchange = status === 'active';

  const steps: Array<{ label: string; done: boolean; inProgress: boolean }> = [
    { label: 'Seller AML verified', done: hasSeller, inProgress: !hasSeller },
    { label: 'Property details confirmed', done: true, inProgress: false },
    { label: 'Title register retrieved (HMLR)', done: exchanged, inProgress: preExchange },
    { label: 'TA6 form complete', done: exchanged, inProgress: preExchange },
    { label: 'TA10 form complete', done: exchanged, inProgress: preExchange },
    { label: 'Buyer joined', done: hasBuyer, inProgress: !hasBuyer && preExchange },
    { label: 'Buyer AML verified', done: hasBuyer && exchanged, inProgress: hasBuyer && preExchange },
    { label: 'Searches ordered', done: exchanged, inProgress: false },
    { label: 'Search results received', done: exchanged, inProgress: false },
    { label: 'Mortgage offer uploaded', done: exchanged, inProgress: false },
    { label: 'Enquiries raised / answered', done: exchanged, inProgress: false },
    { label: 'Deposit confirmed', done: exchanged, inProgress: false },
    { label: 'Conveyancer: TR1 approved', done: exchanged, inProgress: false },
    { label: 'Exchange confirmed', done: exchanged, inProgress: false },
    { label: 'Completion date set', done: Boolean(tx.completionDate) || isAtLeast('completion_initiated'), inProgress: exchanged && !isAtLeast('completion_initiated') },
    { label: 'AP1 submitted to HMLR', done: isAtLeast('blockchain_completed'), inProgress: status === 'completion_initiated' },
    { label: 'Registration confirmed', done: status === 'land_registry_registered', inProgress: status === 'blockchain_completed' },
  ];

  return steps.map((s, i) => ({
    id: i + 1,
    label: s.label,
    status: s.done ? 'complete' as const : s.inProgress ? 'in_progress' as const : 'pending' as const,
  }));
}

const TransactionDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const principalId = usePrincipalId();
  const isAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState<Record<string, string> | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializePage = async () => {
      try {
        // ProtectedRoute handles auth redirect
        if (!principalId || !isAuthenticated) {
          return;
        }

        const parsedUser = { principal: principalId, id: principalId };
        setUser(parsedUser);

        // Initialize ICP service and get user's transactions
        await icpService.initialize();
        const allTxs = await icpService.getAllTransactions();

        // Filter transactions where user is involved (buyer, seller, creator, or in accessList)
        const userTxs = allTxs.filter(tx =>
          tx.buyer === principalId ||
          tx.seller === principalId ||
          tx.createdBy === principalId ||
          tx.accessList?.includes(principalId)
        );

        setTransactions(userTxs);

        // If user has exactly 1 transaction, auto-navigate to it
        if (userTxs.length === 1) {
          logger.info('Single transaction detected, auto-navigating to transaction details');
          navigate(`/transaction/${userTxs[0].id}/status`);
          return;
        }

        setLoading(false);
      } catch (error) {
        logger.error('Error initializing transaction dashboard:', error);
        setLoading(false);
      }
    };

    initializePage();
  }, [principalId, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-900 dark:text-white">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <DashboardHeader
        user={user}
        title="PropXchain"
        subtitle="Transaction Progress Dashboard"
      />

      {/* Main Content with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar activeRoute="/transaction-dashboard" />

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {transactions.length === 0 ? 'No Transactions' :
               transactions.length === 1 ? 'Your Transaction' :
               `All Transactions (${transactions.length})`}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {transactions.length === 0 ? 'Create your first transaction to get started' :
               transactions.length === 1 ? 'Viewing your transaction details' :
               'Select a transaction to view detailed progress'}
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-700 dark:text-gray-300 text-lg mb-2">No transactions found</p>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first transaction to get started</p>
              <button
                onClick={() => navigate('/create-transaction')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                + New Transaction
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {transactions.map((tx) => {
                const milestones = deriveMilestones(tx);
                const completedCount = milestones.filter(m => m.status === 'complete').length;
                const progress = Math.round((completedCount / milestones.length) * 100);
                const progressColor = progress >= 80 ? '#10b981' : progress >= 50 ? '#3b82f6' : progress >= 30 ? '#f59e0b' : '#6b7280';

                return (
                  <div
                    key={tx.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-gray-400 dark:hover:border-gray-500 transition-all"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {tx.propertyAddress}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          £{((tx as any).financialTerms?.purchasePrice || tx.amount || 0).toLocaleString()}
                          <span className="mx-2">&#183;</span>
                          <span className="capitalize">{tx.status?.replace('-', ' ')}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold" style={{ color: progressColor }}>
                        {progress}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, background: progressColor }}
                      />
                    </div>

                    {/* 17-Step Milestone List */}
                    <div className="space-y-1.5 mb-4 max-h-[400px] overflow-y-auto">
                      {milestones.map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5 py-1">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                            m.status === 'complete'
                              ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                              : m.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-500'
                          }`}>
                            {m.status === 'complete' ? '\u2713' : m.status === 'in_progress' ? '\u21BB' : m.id}
                          </span>
                          <span className={`text-sm ${
                            m.status === 'complete'
                              ? 'text-green-600 dark:text-green-400'
                              : m.status === 'in_progress'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {m.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* View Button */}
                    <button
                      onClick={() => navigate(`/transaction/${tx.id}/status`)}
                      className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                    >
                      View Full Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TransactionDashboardPage;
