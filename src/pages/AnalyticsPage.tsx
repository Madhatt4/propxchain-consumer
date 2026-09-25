import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';
import { icpService } from '../services/icp.service';
import { useCanAccessFeature } from '../hooks/useSubscription';
import UpgradePrompt from '../components/subscription/UpgradePrompt';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';

interface Task {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
}

interface Delay {
  phase: string;
  plannedDate: string;
  actualDate: string;
  daysDelayed: number;
  reason: string;
}

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [delays, setDelays] = useState<Delay[]>([]);
  const [forecast, setForecast] = useState<any>(null);

  // Check subscription access - analytics requires Professional tier
  const canAccessAnalytics = useCanAccessFeature('analytics');

  useEffect(() => {
    const loadData = async () => {
      // Check authentication
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      if (!principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }
      const currentUser = { principal: principalId, id: principalId };

      try {
        // Load transactions from blockchain
        const { icpService } = await import('../services/icp.service');
        const allTransactions = await icpService.getAllTransactions();
        const userId = currentUser.principal || currentUser.id; // Use principal for ICP auth

        const userTransactions = Array.isArray(allTransactions)
          ? allTransactions.filter((tx: any) =>
              tx.createdBy === userId ||
              tx.seller === userId ||
              tx.buyer === userId ||
              tx.accessList?.includes(userId)
            )
          : [];

        setTransactions(userTransactions);

        // Auto-select first transaction
        if (userTransactions.length > 0) {
          setSelectedTransaction(userTransactions[0]);
          loadAnalytics(userTransactions[0]);
        }
      } catch (error) {
        logger.error('Error loading transactions from blockchain:', error);
        // Fallback to localStorage
        const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        const userId = currentUser.principal || currentUser.id;
        const userTransactions = Array.isArray(allTransactions)
          ? allTransactions.filter((tx: any) => tx.createdBy === userId)
          : [];
        setTransactions(userTransactions);

        if (userTransactions.length > 0) {
          setSelectedTransaction(userTransactions[0]);
          loadAnalytics(userTransactions[0]);
        }
      }
    };

    loadData();
  }, [navigate]);

  const loadAnalytics = async (transaction: any) => {
    if (!transaction) return;

    // Generate tasks based on transaction status
    const generatedTasks: Task[] = [];
    const userRole = transaction.wizardData?.userRole || 'buyer';

    // Check for outstanding document requirements from blockchain using rate-limited service method
    const documents: Record<string, any> = {};
    try {
      const propertyId = transaction.propertyId || 0;
      const blockchainDocs = await icpService.getPropertyDocuments(propertyId);

      // Convert to object keyed by documentType
      blockchainDocs.forEach((doc: any) => {
        documents[doc.documentType] = doc;
      });
    } catch (error) {
      logger.error('Failed to load documents from blockchain for analytics:', error);
    }

    // AML (Proof of ID / Proof of Address) is not collected by PropXchain at launch —
    // the estate agent and/or conveyancer run their own AML/KYC, so no upload task is
    // generated for individuals. Re-add when the AML provider panel ships.

    if (userRole === 'buyer' && !documents.proofOfFunds) {
      generatedTasks.push({
        id: 'task-3',
        title: 'Upload Proof of Funds',
        assignee: 'You',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        status: 'pending'
      });
    }

    if (userRole === 'seller' && !documents.proofOfOwnership) {
      generatedTasks.push({
        id: 'task-4',
        title: 'Upload Proof of Ownership',
        assignee: 'You',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        status: 'pending'
      });
    }

    // Add milestone-based tasks
    if (transaction.completedPhases && transaction.completedPhases.length < 6) {
      generatedTasks.push({
        id: 'task-5',
        title: 'Complete Property Transaction Wizard',
        assignee: 'You',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'medium',
        status: 'in-progress'
      });
    }

    generatedTasks.push({
      id: 'task-6',
      title: 'Solicitor to review contracts',
      assignee: 'Conveyancer',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'medium',
      status: 'pending'
    });

    if (userRole === 'buyer') {
      generatedTasks.push({
        id: 'task-7',
        title: 'Mortgage approval confirmation',
        assignee: 'Lender',
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        status: 'pending'
      });
    }

    setTasks(generatedTasks);

    // Generate delays analysis
    const generatedDelays: Delay[] = [];
    const createdDate = new Date(transaction.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    // If wizard not completed within expected timeframe
    if (daysSinceCreation > 7 && transaction.completedPhases?.length < 6) {
      generatedDelays.push({
        phase: 'Property Details Wizard',
        plannedDate: new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        actualDate: now.toISOString(),
        daysDelayed: daysSinceCreation - 7,
        reason: 'Wizard phases not completed'
      });
    }

    // If documents not uploaded within expected timeframe
    if (daysSinceCreation > 3 && (!documents.proofOfID || !documents.proofOfAddress)) {
      generatedDelays.push({
        phase: 'Document Upload',
        plannedDate: new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        actualDate: now.toISOString(),
        daysDelayed: daysSinceCreation - 3,
        reason: 'Required documents not submitted'
      });
    }

    setDelays(generatedDelays);

    // Generate forecast
    const completedMilestones = transaction.milestones.filter((m: any) => m.status === 'completed').length;
    const totalMilestones = transaction.milestones.length;
    const progressPercentage = (completedMilestones / totalMilestones) * 100;

    let estimatedCompletionDays = 90; // Default 3 months
    const avgDaysPerMilestone = daysSinceCreation / (completedMilestones || 1);
    const remainingMilestones = totalMilestones - completedMilestones;

    if (completedMilestones > 0) {
      estimatedCompletionDays = Math.ceil(avgDaysPerMilestone * remainingMilestones);
    }

    // Adjust for delays
    const totalDelayDays = generatedDelays.reduce((sum, delay) => sum + delay.daysDelayed, 0);
    estimatedCompletionDays += totalDelayDays;

    const estimatedCompletionDate = new Date(now.getTime() + estimatedCompletionDays * 24 * 60 * 60 * 1000);
    const targetCompletionDate = transaction.financialTerms?.completionDate
      ? new Date(transaction.financialTerms.completionDate)
      : new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    const onTrack = estimatedCompletionDate <= targetCompletionDate;

    setForecast({
      estimatedCompletionDate,
      targetCompletionDate,
      estimatedDays: estimatedCompletionDays,
      progressPercentage,
      onTrack,
      confidenceLevel: completedMilestones > 2 ? 'High' : completedMilestones > 0 ? 'Medium' : 'Low'
    });
  };

  const handleTransactionSelect = (tx: any) => {
    setSelectedTransaction(tx);
    loadAnalytics(tx);
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700',
      low: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'text-gray-600 dark:text-gray-400',
      'in-progress': 'text-gray-500 dark:text-gray-400',
      completed: 'text-green-600 dark:text-green-400'
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400';
  };

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
                      onClick={() => handleTransactionSelect(tx)}
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
              {selectedTransaction && forecast ? (
                <div className="space-y-6">
                  {/* Forecast Card */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Completion Forecast</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estimated Completion</label>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {forecast.estimatedCompletionDate.toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">In {forecast.estimatedDays} days</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Date</label>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {forecast.targetCompletionDate.toLocaleDateString()}
                        </p>
                        <p className={`text-sm font-medium mt-1 ${forecast.onTrack ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {forecast.onTrack ? '✓ On Track' : '⚠ At Risk'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confidence Level</label>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{forecast.confidenceLevel}</p>
                        <div className="mt-2">
                          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                forecast.confidenceLevel === 'High' ? 'bg-green-500' :
                                forecast.confidenceLevel === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{
                                width: forecast.confidenceLevel === 'High' ? '100%' :
                                       forecast.confidenceLevel === 'Medium' ? '60%' : '30%'
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{Math.round(forecast.progressPercentage)}%</span>
                      </div>
                      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                        <div
                          className="bg-gray-600 h-3 rounded-full transition-all"
                          style={{ width: `${forecast.progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Delays */}
                  {delays.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Identified Delays</h3>
                      <div className="space-y-3">
                        {delays.map((delay, index) => (
                          <div key={index} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-gray-900 dark:text-gray-100 font-semibold">{delay.phase}</h4>
                                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{delay.reason}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Planned: {new Date(delay.plannedDate).toLocaleDateString()}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">→</span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Actual: {new Date(delay.actualDate).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-red-600 dark:text-red-500">+{delay.daysDelayed}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">days delayed</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outstanding Tasks */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Outstanding Tasks</h3>
                    <div className="space-y-3">
                      {tasks.filter(t => t.status !== 'completed').map((task) => {
                        const dueDate = new Date(task.dueDate);
                        const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isOverdue = daysUntilDue < 0;

                        return (
                          <div key={task.id} className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-gray-900 dark:text-gray-100 font-medium">{task.title}</h4>
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Assignee: <span className="text-gray-900 dark:text-gray-100">{task.assignee}</span>
                                  </span>
                                  <span className={`${getStatusColor(task.status)}`}>
                                    {task.status.replace('-', ' ')}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-medium ${isOverdue ? 'text-red-600 dark:text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {isOverdue ? 'Overdue' : `Due in ${daysUntilDue} days`}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{dueDate.toLocaleDateString()}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => navigate(`/transaction/${selectedTransaction.id}`)}
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
