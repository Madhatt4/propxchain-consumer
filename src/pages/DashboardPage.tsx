import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardKPICard from '../components/dashboard/DashboardKPICard';
import TransactionProgressTimeline from '../components/dashboard/TransactionProgressTimeline';
import DocumentVerificationGrid from '../components/dashboard/DocumentVerificationGrid';
import StakeholdersPanel from '../components/dashboard/StakeholdersPanel';
import TransactionInvite from '../components/TransactionInvite';
import ChainView from '../components/ChainView';
import MobileNavMenu from '../components/navigation/MobileNavMenu';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { useTheme } from '../contexts/ThemeContext';
import { Transaction, Document as TxDocument, Milestone } from '../types/transaction.types';
import { logger } from '@/utils/logger';
import { usePrincipalId, useIsAuthenticated, getStorePrincipalId } from '../stores/authStore';
import { Logo } from '@/components/brand/Logo';
import { getViewerRole } from '../utils/viewerRole';
import { isCompletedStatus } from '@/types/transactionStatus';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const principalId = usePrincipalId();
  const isAuthenticated = useIsAuthenticated();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<{ principal: string; id: string } | null>(null);
  const [_lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [_showChainView, setShowChainView] = useState(false);
  const [viewMode, setViewMode] = useState<'my-transaction' | 'full-chain'>('my-transaction');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [txDocuments, setTxDocuments] = useState<TxDocument[]>([]);
  const themeClasses = useThemeClasses();
  const { isDark } = useTheme();

  // Function to load transactions
  const loadTransactions = async () => {
    if (!principalId || !isAuthenticated) {
      return;
    }
    const currentUser = { principal: principalId, id: principalId };
    setUser(currentUser);

    try {
      // Load transactions from blockchain
      const { icpService } = await import('../services/icp.service');
      const allTransactions = await icpService.getAllTransactions();
      const userId = currentUser.principal || currentUser.id; // Use principal for ICP auth

      // Ensure allTransactions is an array
      if (Array.isArray(allTransactions)) {
        // Filter for user's transactions (includes buyers who joined via invite code)
        const userTransactions = allTransactions.filter((tx: Transaction) =>
          tx.createdBy === userId ||
          tx.seller === userId ||
          tx.buyer === userId ||
          (tx.accessList && tx.accessList.includes(userId))
        );
        setTransactions(userTransactions);
      } else {
        logger.warn('Blockchain returned non-array:', allTransactions);
        setTransactions([]);
      }
      setLastUpdate(Date.now());
    } catch (error) {
      logger.error('Error loading transactions from blockchain:', error);
      // Fallback to localStorage if blockchain fails
      const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      const userId = currentUser.principal || currentUser.id;
      const userTransactions = Array.isArray(allTransactions)
        ? allTransactions.filter((tx: Transaction) => tx.createdBy === userId)
        : [];
      setTransactions(userTransactions);
      setLastUpdate(Date.now());
    }
  };

  // Load when auth is ready
  useEffect(() => {
    loadTransactions();
  }, [isAuthenticated, principalId]);

  // Auto-refresh when page regains focus (user comes back to tab/page)
  useEffect(() => {
    const handleFocus = () => {
      logger.info('Dashboard: Page focused, refreshing data...');
      loadTransactions();
    };

    window.addEventListener('focus', handleFocus);

    // Also refresh when user navigates back to this page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        logger.info('Dashboard: Page visible, refreshing data...');
        loadTransactions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, principalId]);

  // Derived above the `!user` early return below, because the effect that
  // follows is a hook: leaving it after the return changes the hook count
  // between the loading render and the loaded one ("Rendered more hooks than
  // during the previous render"). Depends only on `transactions`, not `user`.
  const activeTransaction = Array.isArray(transactions)
    ? (transactions.find(tx => !isCompletedStatus(tx.status)) || transactions[0] || null)
    : null;

  // Load actual documents from blockchain for the active transaction
  useEffect(() => {
    if (!activeTransaction?.id) {
      setTxDocuments([]);
      return;
    }
    const loadDocs = async (): Promise<void> => {
      try {
        const { icpService } = await import('../services/icp.service');
        await icpService.initialize();
        const docs = await icpService.getDocumentsByTransaction(activeTransaction.id);
        setTxDocuments(docs || []);
      } catch (err) {
        logger.error('Error loading documents for dashboard:', err);
      }
    };
    loadDocs();
  }, [activeTransaction?.id]);

  // Show loading state until user data is loaded
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themeClasses.pageBg}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${themeClasses.spinner} mx-auto mb-4`}></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate metrics from real transactions
  const activeTransactionsCount = Array.isArray(transactions)
    ? transactions.filter(tx => !isCompletedStatus(tx.status)).length
    : 0;

  const completedThisMonth = Array.isArray(transactions)
    ? transactions.filter(tx => {
        if (!isCompletedStatus(tx.status)) return false;
        const completedDate = new Date(tx.updatedAt || tx.createdAt);
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return completedDate >= monthAgo;
      }).length
    : 0;

  // Blockchain-optimized metrics: 7 days avg (vs 75 days traditional)
  const avgCompletionTime = Array.isArray(transactions) && transactions.length > 0 ? 7 * 24 : 0; // 7 days in hours
  const costSavings = Array.isArray(transactions) ? transactions.length * 1150 : 0; // £1,150 savings per transaction (£1,500 - £350)

  // Get real document status from blockchain documents
  const getDocumentStatus = (tx: Transaction): { uploaded: number; total: number; allUploaded: boolean } => {
    if (!tx) return { uploaded: 0, total: 0, allUploaded: false };

    const principalId = getStorePrincipalId() || '';
    const viewerRole = getViewerRole(tx, principalId);

    // An access-list party (conveyancer, agent) owes nothing personally here,
    // so they get an empty requirement set rather than the buyer's by default.
    // allUploaded stays false so nothing renders as complete on their behalf.
    if (viewerRole === 'other') return { uploaded: 0, total: 0, allUploaded: false };

    // Required doc types per role (base keys, ignoring _person suffixes)
    const requiredTypes = viewerRole === 'seller'
      ? ['proofOfIdentity', 'proofOfAddress', 'titleDeeds', 'energyPerformanceCertificate']
      : ['proofOfIdentity', 'proofOfAddress', 'proofOfFunds'];

    // Match docs belonging to this user (by uploader or category)
    const userDocs = txDocuments.filter((d: TxDocument) =>
      d.uploadedBy === principalId || d.category === viewerRole
    );
    const uploadedTypes = new Set(
      userDocs.map((d: TxDocument) => (d.type || '').replace(/_person\d+$/, ''))
    );
    const uploadedCount = requiredTypes.filter(t => uploadedTypes.has(t)).length;

    return { uploaded: uploadedCount, total: requiredTypes.length, allUploaded: uploadedCount >= requiredTypes.length };
  };

  // Check if contract is ready to sign
  // Uses actual blockchain document data — no localStorage milestones needed
  const checkReadyToSign = (tx: Transaction): boolean => {
    if (!tx) return false;
    // Only active transactions can proceed to exchange
    const status = String(tx.status);
    if (status && status !== 'active' && status !== '#active') return false;
    const docStatus = getDocumentStatus(tx);
    return docStatus.allUploaded;
  };

  const isReadyToSign = activeTransaction ? checkReadyToSign(activeTransaction) : false;
  const docStatus = activeTransaction ? getDocumentStatus(activeTransaction) : { uploaded: 0, total: 0, allUploaded: false };

  // Handler functions for Smart Contract button
  const handleSignContract = () => {
    if (activeTransaction) {
      navigate(`/exchange/${activeTransaction.id}`);
    }
  };

  const handleViewProgress = () => {
    if (activeTransaction) {
      navigate(`/transaction/${activeTransaction.id}`);
    }
  };

  // Dynamic timeline based on actual transaction progress
  const getTimelineSteps = (tx: Transaction | null) => {
    if (!tx) {
      return [
        { label: 'Start Wizard', status: 'pending' as const, sublabel: 'Not Started' },
        { label: 'Upload Documents', status: 'pending' as const, sublabel: 'Waiting' },
        { label: 'Complete Wizard', status: 'pending' as const, sublabel: 'Waiting' },
        { label: 'Contract Exchange', status: 'pending' as const, sublabel: 'Waiting' },
        { label: 'Blockchain Completion', status: 'pending' as const, sublabel: 'Waiting' },
        { label: 'Land Registry', status: 'pending' as const, sublabel: 'Waiting' },
      ];
    }

    // Check for both milestones (new) and completedPhases (old) for backwards compatibility
    const milestones = Array.isArray(tx.milestones) ? tx.milestones : [];
    const completedMilestones = milestones.filter((m: Milestone) => m.status === 'completed').length;
    const totalMilestones = milestones.length;

    // Milestone 1: Initial Information Collected (wizard done)
    const wizardMilestone = milestones.find((m: Milestone) =>
      m.name === 'Initial Information Collected' || m.id === 'initial-info'
    );
    const wizardComplete = wizardMilestone?.status === 'completed';

    // Milestone 2: Documents Collected
    const docsMilestone = milestones.find((m: Milestone) =>
      m.name === 'Documents Collected' || m.id === 'documents'
    );
    const docsComplete = docsMilestone?.status === 'completed';

    // Milestone 6: Contract Exchange
    const exchangeMilestone = milestones.find((m: Milestone) =>
      m.name === 'Contract Exchange' || m.id === 'exchange'
    );
    const txStatus = String(tx.status);
    const isSigned = exchangeMilestone?.status === 'completed' ||
                     txStatus === 'exchanged' || txStatus === '#exchanged';

    // Milestone 7: Completion
    const completionMilestone = milestones.find((m: Milestone) =>
      m.name === 'Completion' || m.id === 'completion'
    );
    const isCompleted = completionMilestone?.status === 'completed' || isCompletedStatus(tx.status);

    // Milestone 8: Land Registry
    const landRegistryMilestone = milestones.find((m: Milestone) =>
      m.name === 'Land Registry Application' || m.id === 'land-registry'
    );
    const landRegistryComplete = landRegistryMilestone?.status === 'completed';

    // Fallback to old completedPhases if milestones don't exist
    const wizardPhases = (tx as unknown as Record<string, unknown>).completedPhases
      ? ((tx as unknown as Record<string, unknown>).completedPhases as unknown[]).length
      : 0;
    // If transaction exists, wizard must be complete (transaction can only be created after wizard)
    const finalWizardComplete = wizardComplete || wizardPhases === 6 || !!tx.id;
    const finalDocsComplete = docsComplete || docStatus.allUploaded;

    return [
      {
        label: 'Wizard Started',
        status: finalWizardComplete ? 'completed' as const : completedMilestones > 0 ? 'active' as const : 'pending' as const,
        sublabel: finalWizardComplete ? 'Complete' : completedMilestones > 0 ? 'In Progress' : 'Not Started'
      },
      {
        label: 'Documents Uploaded',
        status: finalDocsComplete ? 'completed' as const : finalWizardComplete ? 'active' as const : 'pending' as const,
        sublabel: finalDocsComplete ? 'Complete' : `${docStatus.uploaded}/${docStatus.total} docs`
      },
      {
        label: 'Wizard Complete',
        status: finalWizardComplete ? 'completed' as const : completedMilestones > 0 ? 'active' as const : 'pending' as const,
        sublabel: finalWizardComplete ? 'All info collected' : `${completedMilestones}/${totalMilestones} milestones`
      },
      {
        label: 'Contract Exchange',
        status: isSigned ? 'completed' as const : (finalWizardComplete && finalDocsComplete) ? 'active' as const : 'pending' as const,
        sublabel: isSigned ? 'Signed' : 'Ready to Sign'
      },
      {
        label: 'Blockchain Completion',
        status: isCompleted ? 'completed' as const : isSigned ? 'active' as const : 'pending' as const,
        sublabel: isCompleted ? 'Complete' : 'Pending'
      },
      {
        label: 'Land Registry',
        status: landRegistryComplete ? 'completed' as const : isCompleted ? 'active' as const : 'pending' as const,
        sublabel: landRegistryComplete ? 'Registered' : 'Automated'
      },
    ];
  };

  const timelineSteps = getTimelineSteps(activeTransaction);

  // Dynamic document verification based on actual blockchain uploads
  const getDocumentList = (tx: Transaction | null): Array<{ name: string; status: 'pending' | 'verified' }> => {
    const principalId = getStorePrincipalId() || '';
    const viewerRole = getViewerRole(tx, principalId);

    // No personal checklist for an access-list party — see getViewerRole.
    if (viewerRole === 'other') return [];

    // Build lookup of uploaded base types for this user
    const userDocs = txDocuments.filter((d: TxDocument) =>
      d.uploadedBy === principalId || d.category === viewerRole
    );
    const uploadedTypes = new Set(
      userDocs.map((d: TxDocument) => (d.type || '').replace(/_person\d+$/, ''))
    );

    const hasType = (key: string): 'verified' | 'pending' => uploadedTypes.has(key) ? 'verified' : 'pending';

    // AML (Proof of ID / Proof of Address) not collected by PropXchain at launch —
    // agent/conveyancer handle their own AML/KYC. Re-add when the AML panel ships.
    const docList: Array<{ name: string; status: 'verified' | 'pending' }> = [];

    if (viewerRole === 'seller') {
      docList.push({ name: 'Title Deeds', status: hasType('titleDeeds') });
      docList.push({ name: 'EPC', status: hasType('energyPerformanceCertificate') });
    } else {
      docList.push({ name: 'Proof of Funds', status: hasType('proofOfFunds') });
      docList.push({ name: 'Mortgage Agreement', status: hasType('mortgageAgreement') });
    }

    return docList;
  };

  const documents = getDocumentList(activeTransaction);

  const stakeholders = activeTransaction ? [
    { name: user?.principal || 'You', role: activeTransaction.wizardData?.userRole || 'buyer', lastActivity: '2 hrs ago' },
    { name: 'Conveyancer', role: 'solicitor', lastActivity: '1 day ago' },
  ] : [];

  // Handle successful join from invite
  const handleJoinSuccess = (_transaction: Transaction) => {
    setShowInviteModal(false);
    setShowChainView(true);
    loadTransactions();
  };

  // Check if user is part of a chain
  const isPartOfChain = activeTransaction && activeTransaction.parties && activeTransaction.parties.length > 1;

  return (
    <div className={`min-h-screen ${themeClasses.pageBg}`}>
      {/* Header */}
      <header className={themeClasses.headerBg}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Logo variant="mark" tone={isDark ? 'onDark' : 'onLight'} to="/" className="h-11 w-auto" />

              {/* Desktop Navigation - hidden on mobile */}
              <nav className="hidden md:flex space-x-4">
                <button className={`px-4 py-2 ${themeClasses.navActive} rounded-lg font-medium`}>
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/oscar')}
                  className={`px-4 py-2 ${themeClasses.navText}`}
                >
                  Oscar AI
                </button>
                <button
                  onClick={() => navigate('/dashboard/properties')}
                  className={`px-4 py-2 ${themeClasses.navText}`}
                >
                  Properties
                </button>
                <button
                  onClick={() => navigate('/dashboard/stakeholders')}
                  className={`px-4 py-2 ${themeClasses.navText}`}
                >
                  Stakeholders
                </button>
                <button
                  onClick={() => navigate('/dashboard/analytics')}
                  className={`px-4 py-2 ${themeClasses.navText}`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => navigate('/dashboard/settings')}
                  className={`px-4 py-2 ${themeClasses.navText}`}
                >
                  Settings
                </button>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {/* Mobile Menu Button - shown only on mobile */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Open menu"
              >
                <svg
                  className={`w-6 h-6 ${themeClasses.headerText}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <button
                onClick={loadTransactions}
                className={`px-3 py-1 text-xs ${themeClasses.cardSecondary} ${themeClasses.textSecondary} rounded hover:opacity-80 transition-colors`}
                title="Refresh data"
              >
                <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <span className={`text-sm ${themeClasses.textSecondary}`}>{user?.principal || 'User'}</span>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  navigate('/login');
                }}
                className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
            <h2 className={`text-2xl font-bold ${themeClasses.textPrimary}`}>Transaction Dashboard</h2>
          </div>

          {/* Chain Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/start-transaction')}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center min-h-[44px]"
            >
              <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Start New Transaction</span>
              <span className="sm:hidden ml-2">New</span>
            </button>
            {activeTransaction && (
              <button
                onClick={() => navigate(`/transaction/${activeTransaction.id}/share`)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center min-h-[44px]"
              >
                <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Share Transaction</span>
                <span className="sm:hidden ml-2">Share</span>
              </button>
            )}
            <button
              onClick={() => setShowInviteModal(!showInviteModal)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center min-h-[44px]"
            >
              <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="hidden sm:inline">Enter Transaction ID</span>
              <span className="sm:hidden ml-2">Join</span>
            </button>
          </div>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="mb-6">
            <TransactionInvite
              onJoinSuccess={handleJoinSuccess}
              onClose={() => setShowInviteModal(false)}
            />
          </div>
        )}

        {/* Chain View Toggle (if part of chain) */}
        {isPartOfChain && (
          <div className={`${themeClasses.cardBg} rounded-lg p-4 mb-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className={`${themeClasses.textPrimary} font-medium`}>
                  You are part of a transaction chain
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('my-transaction')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'my-transaction'
                      ? themeClasses.navActive
                      : `${themeClasses.cardSecondary} ${themeClasses.textSecondary}`
                  }`}
                >
                  My Transaction
                </button>
                <button
                  onClick={() => setViewMode('full-chain')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'full-chain'
                      ? themeClasses.navActive
                      : `${themeClasses.cardSecondary} ${themeClasses.textSecondary}`
                  }`}
                >
                  Full Chain
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <DashboardKPICard
            title="Active Transactions"
            value={activeTransactionsCount}
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            color="blue"
          />
          <DashboardKPICard
            title="Completed This Month"
            value={completedThisMonth}
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            trend={completedThisMonth > 0 ? { value: `+${completedThisMonth}`, isPositive: true } : undefined}
            color="green"
          />
          <DashboardKPICard
            title="Avg. Completion Time"
            value={`${Math.round(avgCompletionTime / 24)}d`}
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            trend={{ value: '92% faster', isPositive: true }}
            color="purple"
          />
          <DashboardKPICard
            title="Cost Savings"
            value={`£${costSavings.toLocaleString()}`}
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            trend={costSavings > 0 ? { value: '70% saved', isPositive: true } : undefined}
            color="orange"
          />
        </div>

        {/* Conditional View based on mode */}
        {viewMode === 'my-transaction' ? (
          <>
            {/* Transaction Progress Timeline */}
            {activeTransaction && (
              <div className="mb-8">
                <TransactionProgressTimeline
                  steps={timelineSteps}
                  propertyAddress={activeTransaction.propertyAddress}
                  completionPercentage={Array.isArray(timelineSteps) && timelineSteps.length > 0
                    ? Math.round((timelineSteps.filter(s => s.status === 'completed').length / timelineSteps.length) * 100)
                    : 0}
                  estimatedDays={isReadyToSign ? 2 : 5}
                  isReadyToSign={isReadyToSign}
                  onSignContract={handleSignContract}
                  onViewProgress={handleViewProgress}
                />
              </div>
            )}

            {/* Bottom Row: Document Verification + Stakeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <DocumentVerificationGrid documents={documents} />
              <StakeholdersPanel stakeholders={stakeholders} />
            </div>
          </>
        ) : (
          <>
            {/* Full Chain View */}
            {activeTransaction && user && (
              <div className="mb-8">
                <ChainView
                  transactionId={activeTransaction.id}
                  userPrincipal={user.principal || user.id}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Navigation Menu */}
      <MobileNavMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPage="dashboard"
      />
    </div>
  );
};

export default DashboardPage;
