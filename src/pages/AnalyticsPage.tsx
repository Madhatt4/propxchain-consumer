import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';
import NextStepCard from '@/components/common/NextStepCard';
import { PhaseChecklist } from '@/components/transaction/PhaseChecklist';
import { icpService } from '../services/icp.service';
import { useCanAccessFeature } from '../hooks/useSubscription';
import UpgradePrompt from '../components/subscription/UpgradePrompt';
import { useAuthStore } from '../stores/authStore';
import { PHASE_LABELS, PHASE_ORDER } from '../services/phase';
import { overallProgress } from '../services/phaseChecklistLoader';
import { describeStage, describeStall } from '../services/stall.service';
import { formatTargetDate, loadDealAnalytics, type DealAnalytics } from '../services/dealAnalytics';

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [analytics, setAnalytics] = useState<DealAnalytics | null>(null);

  // Check subscription access - analytics requires Premium tier
  const canAccessAnalytics = useCanAccessFeature('analytics');

  useEffect(() => {
    const loadData = async () => {
      const authState = useAuthStore.getState();
      if (!authState.principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }

      // getMyTransactions() filters server-side by caller — getAllTransactions is
      // admin-only and returns [] for everyone else.
      const userTransactions = await icpService.getMyTransactions();
      setTransactions(userTransactions);
      if (userTransactions.length > 0) setSelectedTransaction(userTransactions[0]);
    };

    loadData();
  }, [navigate]);

  const selectedId: string | null = selectedTransaction ? String(selectedTransaction.id) : null;

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    // Clear first: switching transaction must not show the old deal's numbers.
    setAnalytics(null);
    void loadDealAnalytics(selectedId).then((result) => {
      if (active) setAnalytics(result);
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  // Show upgrade prompt if user doesn't have analytics access
  if (!canAccessAnalytics) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <AppTopBar title="Analytics" backTo="/dashboard" backLabel="Back to dashboard" />
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Transaction Analytics</h2>
          <UpgradePrompt feature="analytics" />
        </main>
      </div>
    );
  }

  const checklist = analytics?.checklist ?? null;
  const progressPct = checklist ? Math.round(overallProgress(checklist) * 100) : 0;
  const phaseNumber = checklist ? Math.min(PHASE_ORDER.indexOf(checklist.phase) + 1, PHASE_ORDER.length - 1) : 0;
  const targetDate = selectedTransaction ? formatTargetDate(selectedTransaction.completionDate) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar title="Analytics" backTo="/dashboard" backLabel="Back to dashboard" />

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">

        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Transaction Analytics</h2>

        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">No transactions found</p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first transaction to see analytics.</p>
            <button
              onClick={() => navigate('/create-transaction')}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              Start New Transaction
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Transaction Selector */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-4">Select Transaction</h3>
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedTransaction?.id === tx.id
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-medium text-sm truncate">{tx.propertyAddress}</div>
                      <div className="text-xs opacity-75">{tx.transactionType}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Analytics Content */}
            <div className="lg:col-span-3">
              {selectedId ? (
                <div className="space-y-6">
                  {/* Progress and timing */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Where this deal is</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phase</label>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {checklist ? PHASE_LABELS[checklist.phase] : '…'}
                        </p>
                        {checklist && checklist.phase !== 'completed' && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            Phase {phaseNumber} of {PHASE_ORDER.length - 1}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stage timing</label>
                        <p data-testid="analytics-stage" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {analytics?.stage ? describeStage(analytics.stage) : 'No typical timing for this stage yet'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target completion</label>
                        <p data-testid="analytics-target-date" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {targetDate ?? 'Set at exchange'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall progress</span>
                        <span data-testid="analytics-progress" className="text-sm font-bold text-gray-900 dark:text-gray-100">{progressPct}%</span>
                      </div>
                      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                        <div
                          className="bg-gray-600 h-3 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Your next move: the canister's next-step engine, scoped to the viewer's side */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Your next move</h3>
                    <NextStepCard
                      key={selectedId}
                      txId={selectedId}
                      variant="full"
                      dismissible={false}
                      onAction={() => navigate(`/transaction/${selectedId}/flow`)}
                    />
                  </div>

                  {/* Who the deal is waiting on */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Waiting on</h3>
                    {analytics && analytics.stalls.length > 0 ? (
                      <ul className="space-y-2">
                        {analytics.stalls.map((stall) => (
                          <li key={`${stall.signal}-${stall.owner}`} className="text-sm text-gray-700 dark:text-gray-300">
                            {describeStall(stall)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {analytics ? 'Nothing is holding this deal up right now.' : '…'}
                      </p>
                    )}
                  </div>

                  {/* What's left in this phase, ticked from the audit trail */}
                  {checklist && <PhaseChecklist transactionId={selectedId} stateOverride={checklist} />}

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => navigate(`/transaction/${selectedId}/flow`)}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                    >
                      View Transaction Details
                    </button>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="px-6 py-3 bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 rounded-lg font-medium"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                  <p className="text-gray-700 dark:text-gray-300">Select a transaction from the list to view analytics</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

    </div>
  );
};

export default AnalyticsPage;
