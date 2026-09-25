/**
 * Unified Dashboard - Modern UI with Transaction List & Detail View
 * Consolidates all transaction and property views into ONE dashboard
 * Features: Transaction list, detail view, documents, progress tracking, seller controls
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardSidebar from '../components/navigation/DashboardSidebar';
import DashboardHeader from '../components/navigation/DashboardHeader';
import RegistrationModal from '../components/auth/RegistrationModal';
import TransactionProgress from '../components/dashboard/TransactionProgress';
import QuickActions from '../components/dashboard/QuickActions';
import DocumentUpload from '../components/common/DocumentUpload';
import { Transaction, Document, getDefaultMilestones } from '../types/transaction.types';
import { icpService } from '../services/icp.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '../stores/authStore';
import { cn } from '@/lib/utils';
import '../styles/dashboard.css';
import { logger } from '@/utils/logger';
import { isCompletedStatus } from '@/types/transactionStatus';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  principal?: string;
  createdAt?: string | number;
  mobile?: string;
  username?: string;
  userType?: string;
  isVerified?: boolean;
}

const DashboardModern: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'seller' | 'buyer' | null>(null);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeTransactions: 0,
    documentsUploaded: 0,
    pendingActions: 0,
    completionRate: 0
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    initializeDashboard();
  }, []);

  // Handle transaction selection from URL params or click
  useEffect(() => {
    const txId = searchParams.get('tx');
    if (txId && transactions.length > 0) {
      const tx = transactions.find(t => t.id === txId);
      if (tx) {
        handleSelectTransaction(tx);
      }
    }
  }, [searchParams, transactions]);

  const initializeDashboard = async () => {
    try {
      logger.info('Dashboard: Starting initialization...');

      // Check authentication using auth store
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;
      const isAuthenticated = authState.isAuthenticated;

      logger.info('Dashboard: Principal ID:', principalId ? 'Found' : 'Missing');
      logger.info('Dashboard: Is Authenticated:', isAuthenticated ? 'Yes' : 'No');

      if (!principalId || !isAuthenticated) {
        logger.warn('Dashboard: No auth data, redirecting to login');
        navigate('/login');
        return;
      }

      // Check if user has a pending invite code (from before login redirect)
      const pendingInviteCode = localStorage.getItem('pendingInviteCode');
      if (pendingInviteCode) {
        logger.info('Dashboard: Found pending invite code, redirecting to join page');
        navigate(`/join/${encodeURIComponent(pendingInviteCode)}`);
        return;
      }

      // Set basic user data from principal
      const basicUser = { principal: principalId, id: principalId };
      logger.info('Dashboard: Using principal:', principalId);
      setUser(basicUser);

      // Initialize ICP service with authenticated identity
      logger.info('Dashboard: Initializing ICP service with auth...');
      const { icpService } = await import('../services/icp.service');
      await icpService.initAuth();
      logger.info('Dashboard: ICP service authenticated');

      // Check if user has a profile
      try {
        const profile = await icpService.getMyProfile();
        logger.info('Dashboard: Profile loaded:', profile);

        if (profile) {
          // User has a profile - proceed normally
          setUser({ ...basicUser, ...profile });
          logger.info('Dashboard: User role:', profile.userType);

          // Load user's transactions
          logger.info('Dashboard: Loading transactions...');
          await loadUserTransactions();
        } else {
          // No profile found - show registration modal
          logger.info('Dashboard: No profile found, showing registration modal');
          setShowRegistrationModal(true);
        }
      } catch (error) {
        logger.warn('Dashboard: Could not fetch profile, showing registration modal');
        setShowRegistrationModal(true);
      }

      setLoading(false);
      logger.info('Dashboard: Initialization complete');
    } catch (error) {
      logger.error('Dashboard: Error initializing:', error);
      setLoading(false);
    }
  };

  const handleRegistrationSuccess = async () => {
    logger.info('Registration successful, reloading profile...');
    setShowRegistrationModal(false);

    // Reload the dashboard with the new profile
    await initializeDashboard();
  };

  const loadUserTransactions = async () => {
    try {
      logger.info('Loading user transactions...');
      const principalId = useAuthStore.getState().principalId;

      if (!principalId) {
        logger.warn('No principal ID found');
        setTransactions([]);
        return;
      }

      // Get all transactions from canister
      const allTxs = await icpService.getAllTransactions();
      logger.info(`Loaded ${allTxs.length} transactions from canister`);

      // Filter transactions where user is involved (buyer, seller, creator, or in accessList)
      const userTxs = allTxs.filter(tx =>
        tx.buyer === principalId ||
        tx.seller === principalId ||
        tx.createdBy === principalId ||
        tx.accessList?.includes(principalId)
      );

      logger.info(`Filtered to ${userTxs.length} user transactions`);

      if (userTxs && userTxs.length > 0) {
        logger.info('Setting transactions state with:', userTxs);
        setTransactions(userTxs);
        await calculateStats(userTxs);
      } else {
        logger.warn('No transactions to display');
        setTransactions([]);
      }
    } catch (error) {
      logger.error('Error loading transactions:', error);
      setTransactions([]);
    }
  };

  const calculateStats = async (txs: Transaction[]) => {
    const activeCount = txs.filter(tx => !isCompletedStatus(tx.status)).length;

    // Calculate total user documents
    let docsCount = 0;
    let expiredDocsCount = 0;

    try {
      const allDocuments: any[] = [];

      for (const tx of txs) {
        try {
          if ((tx as any).documents && Array.isArray((tx as any).documents)) {
            allDocuments.push(...(tx as any).documents);
          }

          const propertyId = (tx as any).blockchainPropertyId || (tx as any).propertyId;
          if (propertyId !== undefined && propertyId !== null) {
            try {
              const propertyDocs = await icpService.getPropertyDocuments(Number(propertyId));
              allDocuments.push(...propertyDocs);
            } catch (err) {
              logger.warn('Could not load documents for property');
            }
          }
        } catch (error) {
          logger.error('Error loading documents for transaction', tx.id, error);
        }
      }

      // Remove duplicates
      const uniqueDocs = allDocuments.filter((doc, index, self) =>
        index === self.findIndex((d) =>
          (d.id && doc.id && d.id === doc.id) ||
          (d.verificationDocumentId && doc.verificationDocumentId && d.verificationDocumentId === doc.verificationDocumentId)
        )
      );

      docsCount = uniqueDocs.length;

      // Check for expired documents (older than 3 months)
      const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      expiredDocsCount = uniqueDocs.filter(doc => {
        const uploadedAt = Number(doc.uploadedAt || doc.timestamp || Date.now()) / 1000000;
        return uploadedAt < threeMonthsAgo;
      }).length;

    } catch (error) {
      logger.error('Error calculating document stats:', error);
    }

    // Calculate overall completion rate
    let totalMilestones = 0;
    let completedMilestones = 0;

    txs.forEach(tx => {
      if (tx.milestones && Array.isArray(tx.milestones)) {
        totalMilestones += tx.milestones.length;
        completedMilestones += tx.milestones.filter(m => m.status === 'completed').length;
      }
    });

    const completionRate = totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

    const pendingCount = expiredDocsCount;

    setStats({
      activeTransactions: activeCount,
      documentsUploaded: docsCount,
      pendingActions: pendingCount,
      completionRate
    });
  };

  const handleSelectTransaction = async (tx: Transaction) => {
    try {
      logger.info('Selecting transaction:', tx.id);
      setSelectedTransaction(tx);
      setSearchParams({ tx: tx.id });

      const principalId = useAuthStore.getState().principalId;

      // Determine user's role in this transaction
      if (tx.seller === principalId || tx.createdBy === principalId) {
        setCurrentUserRole('seller');

        // Load invite code for sellers
        if (tx.inviteCode) {
          setInviteCode(tx.inviteCode);
        } else {
          try {
            // Result variant, not an opt — same latent bug as
            // InviteStakeholderModal: the `.length` check never matched.
            const result = await icpService.transactionManager?.getInviteCode(tx.id);
            if (result && 'ok' in result) {
              setInviteCode(result.ok);
            }
          } catch (err) {
            logger.warn('Could not fetch invite code:', err);
          }
        }

        // Get list of buyers
        const buyerList = (tx.accessList || []).filter(
          (principal: string) => principal !== tx.seller && principal !== tx.createdBy
        );
        setBuyers(buyerList);
      } else {
        setCurrentUserRole('buyer');
      }

      // Load documents for this transaction
      try {
        if (typeof icpService.getDocumentsByTransaction === 'function') {
          const txDocuments = await icpService.getDocumentsByTransaction(Number(tx.id));
          setDocuments(txDocuments || []);
        } else {
          logger.warn('getDocumentsByTransaction not available in icpService');
          setDocuments([]);
        }
      } catch (err) {
        logger.warn('Could not load documents from blockchain:', err);
        setDocuments([]);
      }
    } catch (error) {
      logger.error('Error selecting transaction:', error);
    }
  };

  const handleBackToList = () => {
    setSelectedTransaction(null);
    setSearchParams({});
    setCurrentUserRole(null);
    setInviteCode('');
    setBuyers([]);
    setDocuments([]);
  };

  const handleStartTransaction = async (type?: string) => {
    try {
      // Check if profile is complete
      if (!user || !user.email || !user.mobile) {
        const confirmComplete = confirm(
          `Profile Incomplete\n\n` +
          `Please complete your profile before creating a transaction.\n\n` +
          `Click OK to complete your profile now.`
        );

        if (confirmComplete) {
          navigate('/profile-setup');
        }
        return;
      }

      // Profile is complete, proceed to tier picker
      if (type) {
        localStorage.setItem('demoType', type);
      }
      navigate('/start-transaction');
    } catch (error) {
      logger.error('Error starting transaction:', error);
    }
  };

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'new-transaction':
        handleStartTransaction();
        break;
      case 'join-transaction':
        navigate('/join');
        break;
      case 'invite-stakeholder':
        navigate('/dashboard/stakeholders');
        break;
      case 'verify-identity':
        navigate('/profile-setup');
        break;
      default:
        logger.warn('Unknown action:', actionId);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      const { icpService } = await import('../services/icp.service');
      const result = await icpService.deleteTransactionFromCanister(transactionId);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete transaction');
      }

      // If we deleted the currently selected transaction, go back to list
      if (selectedTransaction?.id === transactionId) {
        handleBackToList();
      }

      // Refresh transactions
      await loadUserTransactions();

      alert('Transaction deleted successfully!');
    } catch (error) {
      logger.error('Error deleting transaction');
      alert('Failed to delete transaction. Please try again.');
    }
  };

  const handleEditTransaction = () => {
    if (!selectedTransaction) return;

    const wizardData = {
      transactionType: selectedTransaction.transactionType,
      userRole: selectedTransaction.userRole || '',
      propertyType: selectedTransaction.propertyType,
      propertyCategory: selectedTransaction.propertyCategory,
      buildingHeight: selectedTransaction.buildingHeight || '',
      heritageStatus: selectedTransaction.heritageStatus || '',
      constructionAge: selectedTransaction.constructionAge || '',
      documentData: {
        transactionId: selectedTransaction.id,
        mode: selectedTransaction.mode,
        sellerDocuments: Array.isArray(documents) ? documents.filter(d => d.category === 'seller') : [],
        buyerDocuments: Array.isArray(documents) ? documents.filter(d => d.category === 'buyer') : [],
        sharedDocuments: Array.isArray(documents) ? documents.filter(d => d.category === 'shared') : []
      },
      ta6Data: selectedTransaction.ta6Data || {
        propertyAddress: selectedTransaction.propertyAddress,
        sellerNames: '',
        propertyTenure: '',
        boundaries: '',
        disputes: { type: '', details: '' },
        notices: { type: '', details: '' },
        alterations: { type: '', details: '' },
        guarantees: '',
        insurance: '',
        environmentalMatters: { issues: [], details: '' },
        rightsAndEasements: '',
        services: '',
        connectionAgreements: '',
        transactionDetails: ''
      },
      encumbrances: selectedTransaction.encumbrances || {
        mortgages: { type: '', details: '' },
        restrictiveCovenants: '',
        easements: '',
        rightsOfWay: [],
        planningPermissions: '',
        buildingRegulations: '',
        partyWalls: '',
        chancelRepair: ''
      },
      financialTerms: {
        purchasePrice: (selectedTransaction.financialTerms?.purchasePrice || selectedTransaction.amount || 0).toString(),
        deposit: (selectedTransaction.financialTerms?.deposit || 0).toString(),
        mortgageAmount: selectedTransaction.financialTerms?.mortgageAmount?.toString() || '0',
        completionDate: selectedTransaction.financialTerms?.completionDate || selectedTransaction.completionDate || new Date().toISOString().split('T')[0],
        specialConditions: selectedTransaction.financialTerms?.specialConditions || '',
        fixturesFittings: selectedTransaction.financialTerms?.fixturesFittings || {
          standardItems: [],
          additionalItems: ''
        },
        apportionments: selectedTransaction.financialTerms?.apportionments || ''
      },
      contractData: {
        generatedContract: null,
        complianceChecklist: [],
        exportFormat: ''
      }
    };

    localStorage.setItem('wizardData', JSON.stringify(wizardData));
    localStorage.setItem('currentPhase', '1');
    localStorage.setItem('completedPhases', JSON.stringify([]));
    localStorage.setItem('editingTransactionId', selectedTransaction.id);

    navigate('/create-transaction');
  };

  const handleDocumentUpload = (document: Document) => {
    const updatedDocuments = [...documents, document];
    setDocuments(updatedDocuments);
    alert('Document uploaded successfully to blockchain!');
  };

  const getDocumentsByCategory = (category: 'seller' | 'buyer' | 'shared') => {
    if (!documents || !Array.isArray(documents)) {
      return [];
    }
    return documents.filter(doc => doc.category === category);
  };

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleRevokeBuyer = async (buyerPrincipal: string) => {
    if (!selectedTransaction) return;

    const confirmRevoke = window.confirm(
      'Remove this buyer from the transaction? Their uploaded documents will be deleted. This action cannot be undone.'
    );

    if (!confirmRevoke) return;

    try {
      await icpService.initialize();
      const result = await icpService.revokeBuyer(selectedTransaction.id, buyerPrincipal);

      if (result) {
        alert('Buyer revoked successfully');
        const updatedBuyers = buyers.filter(b => b !== buyerPrincipal);
        setBuyers(updatedBuyers);
      } else {
        alert('Failed to revoke buyer');
      }
    } catch (err) {
      logger.error('Error revoking buyer:', err);
      alert('Error revoking buyer. Please try again.');
    }
  };

  const getCategoryDocumentSummary = (category: 'seller' | 'buyer' | 'shared') => {
    const categoryDocs = getDocumentsByCategory(category);
    const uploaded = categoryDocs.filter(d => d.status === 'uploaded' || d.uploadedAt).length;
    const total = categoryDocs.length;
    const percentage = total > 0 ? Math.round((uploaded / total) * 100) : 0;

    return { uploaded, total, percentage };
  };

  const getTransactionProgress = (tx: Transaction): number => {
    if (!tx.milestones || tx.milestones.length === 0) return 0;
    const completed = tx.milestones.filter(m => m.status === 'completed').length;
    return Math.round((completed / tx.milestones.length) * 100);
  };

  // Loading state with Skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-gray-900">
        <DashboardHeader user={null} title="PropXchain" />
        <div className="flex">
          <aside className="w-64 bg-white dark:bg-gray-800 min-h-screen border-r border-stone-200 dark:border-gray-700 p-4">
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-stone-200 dark:bg-gray-700" />
              ))}
            </div>
          </aside>
          <main className="flex-1 px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
                  <CardHeader>
                    <Skeleton className="h-4 w-24 bg-stone-200 dark:bg-gray-700" />
                    <Skeleton className="h-8 w-16 bg-stone-200 dark:bg-gray-700 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Show registration modal if no profile
  if (showRegistrationModal) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-gray-900 flex items-center justify-center">
        <RegistrationModal onSuccess={handleRegistrationSuccess} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user is solicitor
  const isSolicitor = user.userType === 'solicitor' ||
                      user.userType === 'solicitor_client_linked' ||
                      user.userType === 'solicitor_platform_only' ||
                      user.userType === 'solicitor_transparent' ||
                      user.userType === 'solicitor_managed';

  const currentUserPrincipal = useAuthStore.getState().principalId || '';

  // TRANSACTION DETAIL VIEW
  if (selectedTransaction) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-gray-900">
        <DashboardHeader
          user={user}
          title="PropXchain"
          subtitle={isSolicitor ? (user.userType || 'Solicitor') : undefined}
        />

        <div className="flex">
          <DashboardSidebar activeRoute="/dashboard" userProfile={user} />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Button */}
            <Button
              onClick={handleBackToList}
              variant="outline"
              className="mb-6 border-stone-300 dark:border-gray-600 text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-800"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Button>

            {/* Transaction Header */}
            <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700 mb-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="w-full sm:w-auto">
                    <CardTitle className="text-2xl text-stone-900 dark:text-white mb-3">{selectedTransaction.propertyAddress}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn(
                        selectedTransaction.mode === 'diy' ? 'bg-green-600 hover:bg-green-700' :
                        selectedTransaction.mode === 'hybrid' ? 'bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-stone-800 dark:text-gray-200' :
                        'bg-purple-600 hover:bg-purple-700'
                      )}>
                        {selectedTransaction.mode === 'diy' ? 'DIY Mode' : selectedTransaction.mode === 'hybrid' ? 'Hybrid Mode' : 'Professional Mode'}
                      </Badge>
                      <Badge className="bg-stone-200 dark:bg-gray-700 text-stone-800 dark:text-gray-200">
                        {selectedTransaction.status.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      onClick={handleEditTransaction}
                      className="bg-stone-200 dark:bg-gray-800 hover:bg-stone-300 dark:hover:bg-gray-700 text-stone-900 dark:text-white"
                    >
                      Edit Transaction
                    </Button>
                    <Button
                      onClick={() => navigate(`/transaction/${selectedTransaction.id}/share`)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-stone-500 dark:text-gray-400">Transaction Type</p>
                    <p className="text-lg font-semibold text-stone-900 dark:text-white capitalize">{selectedTransaction.transactionType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 dark:text-gray-400">Purchase Price</p>
                    <p className="text-lg font-semibold text-stone-900 dark:text-white">£{(selectedTransaction.financialTerms?.purchasePrice || selectedTransaction.amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 dark:text-gray-400">Target Completion</p>
                    <p className="text-lg font-semibold text-stone-900 dark:text-white">
                      {selectedTransaction.financialTerms?.completionDate || selectedTransaction.completionDate
                        ? new Date(selectedTransaction.financialTerms?.completionDate || selectedTransaction.completionDate || Date.now()).toLocaleDateString()
                        : 'Not set'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seller Controls */}
            {currentUserRole === 'seller' && (
              <Card className="bg-white dark:bg-gray-800 border-2 border-stone-300 dark:border-gray-600 mb-6">
                <CardHeader>
                  <CardTitle className="text-lg text-stone-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-stone-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Share with Buyers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {inviteCode ? (
                    <div className="bg-stone-100 dark:bg-gray-800 dark:bg-opacity-30 rounded-lg p-4 mb-4">
                      <p className="text-sm text-stone-600 dark:text-gray-300 mb-2">
                        Share this code with buyers to invite them to the transaction:
                      </p>
                      <div className="flex items-center gap-3">
                        <code className="flex-1 text-2xl font-bold text-stone-700 dark:text-gray-300 bg-stone-200 dark:bg-gray-900 px-4 py-3 rounded-lg tracking-widest">
                          {inviteCode}
                        </code>
                        <Button
                          onClick={handleCopyInviteCode}
                          className="bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-stone-900 dark:text-white"
                        >
                          {copiedInvite ? (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy Code
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500 dark:text-gray-400 mb-4">Loading invite code...</p>
                  )}

                  {buyers.length > 0 && (
                    <div>
                      <h4 className="font-medium text-stone-900 dark:text-white mb-3">Buyers in this transaction:</h4>
                      <div className="space-y-2">
                        {buyers.map((buyerPrincipal, index) => (
                          <div key={buyerPrincipal} className="flex items-center justify-between bg-stone-100 dark:bg-gray-700 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-gray-800 flex items-center justify-center text-stone-700 dark:text-gray-200 font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-stone-900 dark:text-white">Buyer {index + 1}</p>
                                <p className="text-xs text-stone-500 dark:text-gray-400 font-mono">{buyerPrincipal.substring(0, 20)}...</p>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleRevokeBuyer(buyerPrincipal)}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Revoke
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {buyers.length === 0 && (
                    <p className="text-sm text-stone-500 dark:text-gray-400 italic">No buyers have joined yet. Share the invite code above.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Progress Milestones */}
            <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-stone-900 dark:text-white">Progress Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(selectedTransaction.milestones || []).map((milestone, index) => (
                    <div key={milestone.id} className="flex items-start">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        milestone.status === 'completed' ? 'bg-green-600' :
                        milestone.status === 'in-progress' ? 'bg-teal-600 dark:bg-gray-800' :
                        'bg-stone-300 dark:bg-gray-600'
                      )}>
                        {milestone.status === 'completed' ? (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : milestone.status === 'in-progress' ? (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <span className="text-stone-600 dark:text-gray-300 font-semibold">{index + 1}</span>
                        )}
                      </div>
                      <div className="ml-4 flex-1">
                        <h4 className="font-medium text-stone-900 dark:text-white">{milestone.name}</h4>
                        <p className="text-sm text-stone-500 dark:text-gray-400">{milestone.description}</p>
                        {milestone.completedAt && (
                          <p className="text-xs text-stone-400 dark:text-gray-500 mt-1">Completed: {new Date(milestone.completedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* GDPR Participants */}
            <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-stone-900 dark:text-white">Transaction Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Seller */}
                  <div className="flex items-center gap-3 p-3 bg-stone-100 dark:bg-gray-700 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-200 font-bold">
                      S
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-stone-900 dark:text-white">
                        {selectedTransaction.seller === currentUserPrincipal ? 'You' : 'Seller/Developer'}
                      </p>
                      <p className="text-sm text-stone-500 dark:text-gray-400">Property Owner</p>
                    </div>
                    {selectedTransaction.seller === currentUserPrincipal && (
                      <Badge className="bg-stone-200 dark:bg-gray-800 text-stone-700 dark:text-gray-200">You</Badge>
                    )}
                  </div>

                  {/* Buyers */}
                  {buyers.map((buyerPrincipal, index) => (
                    <div key={buyerPrincipal} className="flex items-center gap-3 p-3 bg-stone-100 dark:bg-gray-700 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-200 font-bold">
                        B{index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-stone-900 dark:text-white">
                          {buyerPrincipal === currentUserPrincipal ? 'You' : `Buyer ${index + 1}`}
                        </p>
                        <p className="text-sm text-stone-500 dark:text-gray-400">Prospective Purchaser</p>
                      </div>
                      {buyerPrincipal === currentUserPrincipal && (
                        <Badge className="bg-stone-200 dark:bg-gray-800 text-stone-700 dark:text-gray-200">You</Badge>
                      )}
                    </div>
                  ))}

                  {buyers.length === 0 && currentUserRole === 'buyer' && (
                    <div className="flex items-center gap-3 p-3 bg-stone-100 dark:bg-gray-700 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-200 font-bold">
                        B
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-stone-900 dark:text-white">You</p>
                        <p className="text-sm text-stone-500 dark:text-gray-400">Prospective Purchaser</p>
                      </div>
                      <Badge className="bg-stone-200 dark:bg-gray-800 text-stone-700 dark:text-gray-200">You</Badge>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-stone-100 dark:bg-gray-800 dark:bg-opacity-20 rounded-lg border border-stone-200 dark:border-gray-700">
                  <p className="text-xs text-stone-600 dark:text-gray-200 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>
                      <strong>Privacy Notice:</strong> Contact details are hidden to protect participant privacy in compliance with GDPR.
                      Only names and roles are visible to maintain transaction transparency.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Documents with Category-Level Privacy */}
            <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-stone-900 dark:text-white">Transaction Documents</CardTitle>
                <CardDescription className="text-stone-500 dark:text-gray-400">
                  {currentUserRole === 'seller'
                    ? 'Upload property documents. Buyer document status is shown below for transparency.'
                    : 'Upload your buyer documents. Seller document status is shown for transparency.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* SELLER VIEW */}
                  {currentUserRole === 'seller' && (
                    <>
                      {/* My Seller Documents */}
                      <div>
                        <h4 className="font-medium text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          MY DOCUMENTS (Seller)
                        </h4>
                        <div className="space-y-4">
                          <DocumentUpload
                            transactionId={selectedTransaction.id}
                            documentType="title-deeds"
                            documentName="Title Deeds"
                            category="seller"
                            required={true}
                            onUpload={handleDocumentUpload}
                            existingDocument={getDocumentsByCategory('seller').find(d => d.type === 'title-deeds')}
                          />
                          <DocumentUpload
                            transactionId={selectedTransaction.id}
                            documentType="epc-certificate"
                            documentName="Energy Performance Certificate"
                            category="seller"
                            required={true}
                            onUpload={handleDocumentUpload}
                            existingDocument={getDocumentsByCategory('seller').find(d => d.type === 'epc-certificate')}
                          />
                        </div>
                      </div>

                      {/* Buyer Documents Summary */}
                      <div className="border-t border-stone-200 dark:border-gray-700 pt-6">
                        <h4 className="font-medium text-stone-900 dark:text-white mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            BUYER DOCUMENTS
                          </span>
                          <span className={cn(
                            "text-sm",
                            getCategoryDocumentSummary('buyer').percentage === 100 ? 'text-green-500 dark:text-green-400' : 'text-yellow-500 dark:text-yellow-400'
                          )}>
                            {getCategoryDocumentSummary('buyer').uploaded}/{getCategoryDocumentSummary('buyer').total} Complete
                          </span>
                        </h4>
                        <div className="bg-stone-100 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="w-full bg-stone-200 dark:bg-gray-600 rounded-full h-3">
                                <div
                                  className={cn(
                                    "h-3 rounded-full transition-all",
                                    getCategoryDocumentSummary('buyer').percentage === 100 ? 'bg-green-500' : 'bg-yellow-500'
                                  )}
                                  style={{ width: `${getCategoryDocumentSummary('buyer').percentage}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-stone-500 dark:text-gray-400 mt-2">
                                {getCategoryDocumentSummary('buyer').percentage === 100
                                  ? 'All buyer documents uploaded'
                                  : `Waiting for buyer to upload ${getCategoryDocumentSummary('buyer').total - getCategoryDocumentSummary('buyer').uploaded} document(s)`}
                              </p>
                            </div>
                            <div className="text-3xl font-bold text-stone-400 dark:text-gray-500">
                              {getCategoryDocumentSummary('buyer').percentage}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* BUYER VIEW */}
                  {currentUserRole === 'buyer' && (
                    <>
                      {/* Seller Documents Summary */}
                      <div>
                        <h4 className="font-medium text-stone-900 dark:text-white mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            SELLER DOCUMENTS
                          </span>
                          <span className={cn(
                            "text-sm",
                            getCategoryDocumentSummary('seller').percentage === 100 ? 'text-green-500 dark:text-green-400' : 'text-yellow-500 dark:text-yellow-400'
                          )}>
                            {getCategoryDocumentSummary('seller').uploaded}/{getCategoryDocumentSummary('seller').total} Complete
                          </span>
                        </h4>
                        <div className="bg-stone-100 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="w-full bg-stone-200 dark:bg-gray-600 rounded-full h-3">
                                <div
                                  className={cn(
                                    "h-3 rounded-full transition-all",
                                    getCategoryDocumentSummary('seller').percentage === 100 ? 'bg-green-500' : 'bg-yellow-500'
                                  )}
                                  style={{ width: `${getCategoryDocumentSummary('seller').percentage}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-stone-500 dark:text-gray-400 mt-2">
                                {getCategoryDocumentSummary('seller').percentage === 100
                                  ? 'All seller documents uploaded'
                                  : `Seller preparing ${getCategoryDocumentSummary('seller').total - getCategoryDocumentSummary('seller').uploaded} document(s)`}
                              </p>
                            </div>
                            <div className="text-3xl font-bold text-stone-400 dark:text-gray-500">
                              {getCategoryDocumentSummary('seller').percentage}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* My Buyer Documents */}
                      <div className="border-t border-stone-200 dark:border-gray-700 pt-6">
                        <h4 className="font-medium text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          MY DOCUMENTS (Buyer)
                        </h4>
                        <div className="space-y-4">
                          {/* AML (Proof of Identity) not collected by PropXchain at launch —
                              agent/conveyancer run their own AML/KYC. Re-add when the AML panel ships. */}
                          <DocumentUpload
                            transactionId={selectedTransaction.id}
                            documentType="proof-of-funds"
                            documentName="Proof of Funds"
                            category="buyer"
                            required={true}
                            onUpload={handleDocumentUpload}
                            existingDocument={getDocumentsByCategory('buyer').find(d => d.type === 'proof-of-funds')}
                          />
                          <DocumentUpload
                            transactionId={selectedTransaction.id}
                            documentType="mortgage-agreement"
                            documentName="Mortgage Agreement (if applicable)"
                            category="buyer"
                            required={false}
                            onUpload={handleDocumentUpload}
                            existingDocument={getDocumentsByCategory('buyer').find(d => d.type === 'mortgage-agreement')}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Shared Documents */}
                  <div className="border-t border-stone-200 dark:border-gray-700 pt-6">
                    <h4 className="font-medium text-stone-900 dark:text-white mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-stone-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      SHARED DOCUMENTS
                    </h4>
                    <div className="space-y-4">
                      <DocumentUpload
                        transactionId={selectedTransaction.id}
                        documentType="property-searches"
                        documentName="Property Searches"
                        category="shared"
                        required={true}
                        onUpload={handleDocumentUpload}
                        existingDocument={getDocumentsByCategory('shared').find(d => d.type === 'property-searches')}
                      />
                      <DocumentUpload
                        transactionId={selectedTransaction.id}
                        documentType="survey-report"
                        documentName="Survey Report"
                        category="shared"
                        required={false}
                        onUpload={handleDocumentUpload}
                        existingDocument={getDocumentsByCategory('shared').find(d => d.type === 'survey-report')}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD VIEW (Transaction List)
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gray-900">
      <DashboardHeader
        user={user}
        title="PropXchain"
        subtitle={isSolicitor ? (user.userType || 'Solicitor') : undefined}
      />

      <div className="flex">
        <DashboardSidebar activeRoute="/dashboard" userProfile={user} />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <QuickActions onAction={handleQuickAction} />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardDescription className="text-stone-500 dark:text-gray-400 font-medium">
                ACTIVE TRANSACTIONS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600 dark:text-gray-500 mb-1">
                {stats.activeTransactions}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">Active property deals</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardDescription className="text-stone-500 dark:text-gray-400 font-medium">
                DOCUMENTS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                {stats.documentsUploaded}
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400">Total uploaded</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardDescription className="text-stone-500 dark:text-gray-400 font-medium">
                DOCUMENT RENEWALS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-3xl font-bold mb-1",
                stats.pendingActions > 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}>
                {stats.pendingActions}
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400">
                {stats.pendingActions > 0 ? 'Documents older than 3 months' : 'All documents current'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardDescription className="text-stone-500 dark:text-gray-400 font-medium">
                COMPLETION RATE
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-3xl font-bold mb-1",
                stats.completionRate >= 50 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
              )}>
                {stats.completionRate}%
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400">Overall progress</p>
            </CardContent>
          </Card>
        </div>

        {/* My Tasks Section */}
        {transactions.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-xl text-stone-900 dark:text-white">My Current Tasks</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-3">
              {transactions.map(tx => {
                const userRole = tx.wizardData?.userRole || user?.userType || 'buyer';
                const pendingMilestones = tx.milestones?.filter(m => m.status === 'pending' || m.status === 'in-progress') || [];
                const nextMilestone = pendingMilestones[0];

                if (!nextMilestone) return null;

                const isMyTask = nextMilestone.id === 'milestone-2' ||
                                 (nextMilestone.id === 'milestone-6' && userRole !== 'solicitor_client_linked');

                if (!isMyTask && !isSolicitor) return null;

                return (
                  <div key={`task-${tx.id}`} className="bg-stone-100 dark:bg-gray-700 border border-stone-200 dark:border-gray-600 rounded-lg p-4 hover:border-stone-300 dark:hover:border-gray-500 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-teal-600 dark:text-gray-500">{tx.propertyAddress}</span>
                          {nextMilestone.status === 'in-progress' && (
                            <Badge className="bg-yellow-600 text-yellow-100">IN PROGRESS</Badge>
                          )}
                        </div>
                        <h4 className="text-stone-900 dark:text-white font-medium mb-1">{nextMilestone.name}</h4>
                        <p className="text-sm text-stone-600 dark:text-gray-300 mb-2">{nextMilestone.description}</p>

                        {nextMilestone.id === 'milestone-2' && (
                          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Upload required documents to complete</span>
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        {nextMilestone.id === 'milestone-2' && (
                          <Button
                            onClick={() => handleSelectTransaction(tx)}
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white whitespace-nowrap"
                          >
                            Upload Docs
                          </Button>
                        )}
                        {nextMilestone.id === 'milestone-6' && (
                          <Button
                            onClick={() => navigate(`/exchange/${tx.id}`)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                          >
                            Sign Contract
                          </Button>
                        )}
                        {nextMilestone.id !== 'milestone-2' && nextMilestone.id !== 'milestone-6' && (
                          <Button
                            onClick={() => handleSelectTransaction(tx)}
                            size="sm"
                            variant="secondary"
                            className="bg-stone-200 dark:bg-gray-600 hover:bg-stone-300 dark:hover:bg-gray-500 text-stone-900 dark:text-white whitespace-nowrap"
                          >
                            View Progress
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
              {transactions.every(tx => {
                const pendingMilestones = tx.milestones?.filter(m => m.status === 'pending' || m.status === 'in-progress') || [];
                return pendingMilestones.length === 0;
              }) && (
                <div className="text-center py-6 text-stone-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">All caught up! No pending tasks.</p>
                </div>
              )}
            </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions List */}
        <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-stone-900 dark:text-white">
                {isSolicitor ? 'Client Transactions' : 'My Transactions'}
              </CardTitle>
              {transactions.length > 0 && (
                <Badge className="bg-stone-200 dark:bg-gray-700 text-stone-800 dark:text-white hover:bg-stone-300 dark:hover:bg-gray-600">
                  {transactions.length} Total
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
          {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-stone-600 dark:text-gray-300 text-lg mb-2">No transactions yet</p>
                  <p className="text-sm text-stone-500 dark:text-gray-500 mb-6">
                    Complete the wizard to create your first transaction
                  </p>
                  <Button
                    onClick={() => handleStartTransaction()}
                    size="lg"
                    className="bg-teal-600 hover:bg-teal-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white"
                  >
                    Create First Transaction
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((tx) => {
                    const progress = getTransactionProgress(tx);
                    const progressColor = progress >= 80 ? '#10b981' : progress >= 50 ? '#3b82f6' : progress >= 30 ? '#f59e0b' : '#ef4444';

                    return (
                      <div
                        key={tx.id}
                        className="bg-stone-100 dark:bg-gray-700 border border-stone-200 dark:border-gray-600 rounded-lg p-5 hover:border-stone-300 dark:hover:border-gray-500 transition-colors cursor-pointer"
                        onClick={() => handleSelectTransaction(tx)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ flex: 1 }}>
                            <div className="flex items-center gap-3 mb-3">
                              <h4 className="text-lg font-semibold text-stone-900 dark:text-white">
                                {tx.propertyAddress}
                              </h4>
                              <Badge variant={tx.mode === 'diy' ? 'default' : 'secondary'} className={cn(
                                tx.mode === 'diy' && 'bg-green-600 hover:bg-green-700',
                                tx.mode === 'hybrid' && 'bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-stone-800 dark:text-gray-200',
                                tx.mode === 'professional' && 'bg-yellow-600 hover:bg-yellow-700'
                              )}>
                                {tx.mode?.toUpperCase() || 'N/A'}
                              </Badge>
                            </div>

                            <div className="flex flex-col gap-1 mb-4">
                              <div className="text-sm text-stone-500 dark:text-gray-400">
                                <span className="font-medium text-stone-700 dark:text-gray-300">Type:</span> {tx.transactionType} ·
                                <span className="font-medium text-stone-700 dark:text-gray-300 ml-2">Status:</span> {tx.status?.replace('-', ' ')}
                              </div>
                              <div className="text-sm text-stone-500 dark:text-gray-400">
                                <span className="font-medium text-stone-700 dark:text-gray-300">Price:</span> £{(tx.financialTerms?.purchasePrice || tx.amount || 0).toLocaleString()} ·
                                <span className="font-medium text-stone-700 dark:text-gray-300 ml-2">Created:</span> {new Date(tx.createdAt).toLocaleDateString()}
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="flex justify-between mb-2">
                                <span className="text-xs font-medium text-stone-500 dark:text-gray-400">
                                  Transaction Journey
                                </span>
                                <span className="text-xs font-semibold" style={{ color: progressColor }}>{progress}% Complete</span>
                              </div>

                              <TransactionProgress milestones={
                                (tx.milestones && tx.milestones.length > 0)
                                  ? tx.milestones
                                  : getDefaultMilestones(tx.mode || 'diy')
                              } />
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTransaction(tx);
                              }}
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white whitespace-nowrap"
                            >
                              View Details
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTransaction(tx.id);
                              }}
                              size="sm"
                              variant="outline"
                              className="border-red-500 dark:border-red-600 text-red-500 dark:text-red-400 hover:bg-red-600 hover:text-white whitespace-nowrap"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </CardContent>
        </Card>
      </main>
      </div>
    </div>
  );
};

export default DashboardModern;
