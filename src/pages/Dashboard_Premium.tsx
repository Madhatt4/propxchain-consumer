/**
 * PropXchain - Premium Dashboard UI
 * Modern transaction tracking interface with real-time transparency
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Dashboard_Premium.css';
import TransactionInvite from '../components/TransactionInvite';
import SolicitorCard from '../components/dashboard/SolicitorCard';
import PropertyPriceHistory from '../components/property/PropertyPriceHistory';
import TransactionDetailTabs from '../components/transaction/TransactionDetailTabs';
import { Transaction, Document } from '../types/transaction.types';
import { TRANSACTION_STATUS_LABEL, TRANSACTION_STATUS_PROGRESS, isTransactionStatus } from '@/types/transactionStatus';
// subscriptionService removed — consumer model uses £75 flat fee per transaction
import { LandRegistryAddress, LAND_REGISTRY_URLS } from '../services/landRegistryService';
// useTransactionProgressFromData removed - progress tracking to be reimplemented
import { getPartyCountsForTransaction, getRequiredDocumentsForRole } from '../constants/documentTypes';
import PortalShell from '../components/navigation/PortalShell';
import TransactionListCard from '../components/dashboard/TransactionListCard';
import { Link2, Plus } from 'lucide-react';

/** Side-menu sections for the signed-in consumer. Same order as the old sidebar. */
const DASHBOARD_SECTIONS = [
  { label: 'Transactions', to: '/dashboard', end: true },
  { label: 'Analytics', to: '/dashboard/analytics' },
  { label: 'Wallet', to: '/dashboard/my-documents' },
  { label: 'Property logbook', to: '/dashboard/my-logbooks' },
  { label: 'AI agents', to: '/dashboard/bot-agents' },
  { label: 'Messages', to: '/messages' },
];
import { logger } from '@/utils/logger';
import { useTheme } from '@/contexts/ThemeContext';
import { SplitPanelProvider, useSplitPanel } from '../contexts/SplitPanelContext';
import type { DocumentProofInfo } from '../types/splitPanel.types';
import { NewDocumentBadge } from '@/components/documents/NewDocumentBadge';
import { getNewDocumentCount } from '@/utils/documentAcknowledgment';
import { isAdminPrincipal } from '@/constants/adminPrincipals';
import { useActiveTransactionStore } from '../stores/activeTransactionStore';
import { useAuthStore, usePrincipalId, useIsAuthenticated } from '../stores/authStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getRightmoveData, syncListingFromChain } from '@/utils/rightmoveStorage';
import NextStepCard from '@/components/common/NextStepCard';
import WelcomeCards from '@/components/onboarding/WelcomeCards';
import DemoPropertyCard from '@/components/onboarding/DemoPropertyCard';
import {
  hasSeenWelcomeCards,
  markWelcomeCardsSeen,
  hasDismissedDemoProperty,
  dismissDemoProperty,
} from '@/utils/firstRun';

// View modes for the dashboard
type ViewMode = 'list' | 'detail';

/**
 * Inner component that consumes SplitPanelContext
 * Must be wrapped by SplitPanelProvider to access context
 */
const Dashboard_PremiumContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const principalId = usePrincipalId();
  const isAuthenticated = useIsAuthenticated();
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const storeProfile = useAuthStore((s) => s.userProfile);
  const { isAdmin: isAdminFromCanister } = useIsAdmin();

  // Developer users with a pending org should be on /builder, not /dashboard.
  // Exception: platform admins — they use /dashboard to test the consumer-side
  // flow while also having a developer membership, so they must NOT be bounced.
  useEffect(() => {
    if (!supabaseUser?.user_metadata?.propxchain_pending_developer_org) return;
    if (isAdminPrincipal(principalId)) return;
    navigate('/builder', { replace: true });
  }, [supabaseUser, navigate, principalId]);
  const [user, setUser] = useState<{ principal: string; name?: string; email?: string; userType?: unknown } | null>(null);

  // Display name: ICP profile → Supabase metadata → email prefix → 'User'
  const displayName = user?.name
    || storeProfile?.name
    || supabaseUser?.user_metadata?.name
    || supabaseUser?.email?.split('@')[0]
    || 'User';

  // Get transactions and documents from context - single source of truth
  const {
    transactions,
    refreshTransactions,
    transactionDocuments: contextDocuments,
    refreshDocuments,
    setSelectedTransaction: setContextTransaction,
  } = useSplitPanel();

  const [selectedTransaction, setSelectedTransactionLocal] = useState<Transaction | null>(null);
  const setActiveTransaction = useActiveTransactionStore((s) => s.setActiveTransaction);

  // Sync local selection with SplitPanel context so it loads documents
  const setSelectedTransaction = useCallback((tx: Transaction | null) => {
    setSelectedTransactionLocal(tx);
    setContextTransaction(tx);
  }, [setContextTransaction]);

  // Publish the selection app-wide. SplitPanelProvider wraps only this page, so
  // anything mounted above it — the support chat widget — has no other way to
  // know which deal the user is looking at. Cleared on the way out, so a later
  // page cannot tell support about a transaction no longer on screen.
  useEffect(() => {
    setActiveTransaction(selectedTransaction ? { id: selectedTransaction.id, status: selectedTransaction.status } : null);
    return () => setActiveTransaction(null);
  }, [selectedTransaction, setActiveTransaction]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // List-view role filter. Local only — filters the already-loaded array.
  const [roleFilter, setRoleFilter] = useState<'all' | 'seller' | 'buyer'>('all');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteForSolicitor, setShowInviteForSolicitor] = useState(false);

  // Determine user's role in a given transaction
  const getUserRole = (tx: Transaction): 'buyer' | 'seller' => {
    const pid = principalId || '';
    if (tx.seller === pid || tx.createdBy === pid) {
      return 'seller';
    }
    return 'buyer';
  };

  // Property edit modal state
  const [showPropertyEditModal, setShowPropertyEditModal] = useState(false);
  const [editPostcode, setEditPostcode] = useState('');

  // Delete confirmation modal state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteTargetTransaction, setDeleteTargetTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Leave confirmation modal state — for transactions the user joined but
  // didn't create. Mirrors the delete-confirm shape so the UX is consistent;
  // the canister-side path is leaveTransaction, not deleteTransaction.
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [leaveTargetTransaction, setLeaveTargetTransaction] = useState<Transaction | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [listingSyncCount, setListingSyncCount] = useState(0);

  // First-run welcome carousel + seeded demo property. Lazy initialisers so
  // localStorage is read once, not on every render.
  const [showWelcomeCards, setShowWelcomeCards] = useState(() => !hasSeenWelcomeCards(principalId));
  const [showDemoProperty, setShowDemoProperty] = useState(() => !hasDismissedDemoProperty(principalId));

  const handleWelcomeClose = useCallback((dontShowAgain: boolean): void => {
    setShowWelcomeCards(false);
    if (dontShowAgain) markWelcomeCardsSeen(principalId);
  }, [principalId]);

  const handleDemoDismiss = useCallback((): void => {
    setShowDemoProperty(false);
    dismissDemoProperty(principalId);
  }, [principalId]);

  const { isDark } = useTheme();

  // Subscription state removed — consumer model uses £75 flat fee

  // Progress tracking state (detail view only — cards use status-based progress)
  const [, setTransactionDocuments] = useState<Document[]>([]);
  // Cache doc-based progress per transaction so list view cards reflect it
  const docProgressCache = useRef<Record<string, number>>({});

  // Helper to infer category from document type
  const inferCategory = (docType: string): 'seller' | 'buyer' | 'shared' => {
    const sellerTypes = ['titleDeeds', 'energyPerformanceCertificate', 'ta6PropertyInformationForm', 'ta10FittingsContents', 'title-deeds', 'epc-certificate', 'ta6-form', 'ta10-form'];
    const buyerTypes = ['proofOfIdentity', 'proofOfAddress', 'proofOfFunds', 'mortgageAgreement', 'proof-of-identity', 'proof-of-address', 'proof-of-funds', 'mortgage-agreement', 'buyer-id', 'buyer-proof-of-address'];
    if (sellerTypes.some(t => docType.includes(t) || docType.startsWith('seller'))) return 'seller';
    if (buyerTypes.some(t => docType.includes(t) || docType.startsWith('buyer'))) return 'buyer';
    return 'shared';
  };

  /** Icon mapping for document storageKeys */
  const DOC_ICONS: Record<string, string> = {
    proofOfIdentity: '\u{1FAAA}',
    proofOfAddress: '\u{1F4EC}',
    proofOfFunds: '\u{1F4B7}',
    mortgageAgreement: '\u{1F3E6}',
    titleDeeds: '\u{1F4DC}',
    energyPerformanceCertificate: '\u{26A1}',
    ta6PropertyInformationForm: '\u{1F4CB}',
    ta10FittingsContents: '\u{1F3E0}',
  };

  /** Document type equivalence groups for matching */
  const DOC_TYPE_GROUPS: string[][] = [
    ['proofOfIdentity', 'proof-of-identity', 'Proof of Identity', 'buyer-id', 'seller-id'],
    ['proofOfAddress', 'proof-of-address', 'Proof of Address', 'buyer-proof-of-address', 'seller-proof-of-address'],
    ['proofOfFunds', 'proof-of-funds', 'Proof of Funds'],
    ['mortgageAgreement', 'mortgage-agreement', 'Mortgage Agreement'],
    ['titleDeeds', 'title-deeds', 'Title Deeds'],
    ['energyPerformanceCertificate', 'epc-certificate', 'Energy Performance Certificate', 'EPC'],
    ['ta6PropertyInformationForm', 'ta6-form', 'TA6 Property Information Form', 'TA6'],
    ['ta10FittingsContents', 'ta10-form', 'TA10 Fittings & Contents Form', 'TA10'],
  ];

  /** Check if a document matches a target storageKey via equivalence groups.
   *  Strips _person1/_person2 suffixes from docType before matching so that
   *  person-variant uploads (e.g. proofOfAddress_person2) still count as
   *  base-type matches. Supports both hyphen and underscore separators. */
  const docMatchesType = (docType: string, targetStorageKey: string): boolean => {
    if (docType === targetStorageKey) return true;
    // Strip person-variant suffix so "proofOfAddress_person2" → "proofOfAddress"
    const normalised = docType.replace(/[_-]person[12]$/i, '');
    if (normalised === targetStorageKey) return true;
    const group = DOC_TYPE_GROUPS.find(g => g.includes(targetStorageKey));
    if (!group) return false;
    return group.some(g =>
      docType === g || normalised === g ||
      docType.startsWith(g + '-') || docType.startsWith(g + '_')
    );
  };

  /**
   * Build a dynamic checklist for a role using party counts and uploadedBy filtering.
   * For Person 1/Person 2 expanded docs, counts matching uploads:
   *   1 upload → Person 1 done; 2+ uploads → both done.
   *
   * Filtering strategy:
   * - Role-exclusive types (e.g. titleDeeds for seller, proofOfFunds for buyer):
   *   match any doc of that type — no uploadedBy filter needed.
   * - Shared types (proofOfIdentity, proofOfAddress — required by both roles):
   *   filter by uploadedBy to prevent cross-role ticking.
   */
  const buildChecklist = (
    role: 'buyer' | 'seller',
    tx: Transaction,
    docs: (Document | DocumentProofInfo)[]
  ): Array<{ label: string; desc: string; icon: string; done: boolean }> => {
    const partyCounts = getPartyCountsForTransaction(tx.id);
    const count = role === 'buyer' ? partyCounts.buyerCount : partyCounts.sellerCount;
    const requiredDocs = getRequiredDocumentsForRole(role, tx, count);

    // Types required by BOTH buyer and seller — need uploadedBy filtering
    const sharedStorageKeys = new Set(['proofOfIdentity', 'proofOfAddress']);

    // Principals that belong to this role (for filtering shared types)
    const currentPrincipal = principalId || '';
    const rolePrincipals = new Set<string>([currentPrincipal].filter(Boolean));
    if (role === 'seller') {
      if (tx.seller) rolePrincipals.add(tx.seller);
      if (tx.createdBy) rolePrincipals.add(tx.createdBy);
    } else {
      if (tx.buyer) rolePrincipals.add(String(tx.buyer || ''));
    }

    // Normalize docs from either Document[] or contextDocuments (DocumentProofInfo[])
    // contextDocuments have docType; Document[] have type and status
    const validDocs = docs.map(d => ({
      type: ('docType' in d ? d.docType : '') || ('type' in d ? d.type : '') || '',
      uploadedBy: String('uploadedBy' in d ? d.uploadedBy : ''),
      status: ('status' in d ? d.status : '') || ('verified' in d && d.verified ? 'verified' : 'uploaded'),
    })).filter(d => d.status === 'uploaded' || d.status === 'verified');

    return requiredDocs.map(reqDoc => {
      // Extract base storageKey (strip _person1/_person2 suffix)
      const baseKey = reqDoc.storageKey.replace(/_person[12]$/, '');
      const isPersonVariant = reqDoc.storageKey !== baseKey;
      const isSharedType = sharedStorageKeys.has(baseKey);

      // Pick relevant docs: filter by uploadedBy only for shared types
      const pool = isSharedType
        ? validDocs.filter(d => {
            const uploader = String(d.uploadedBy || '');
            // If no uploader info, can't filter — exclude to be safe
            if (!uploader) return false;
            return rolePrincipals.has(uploader);
          })
        : validDocs;

      let isDone = false;
      if (isPersonVariant) {
        const matchCount = pool.filter(d => docMatchesType(d.type, baseKey)).length;
        const personNum = reqDoc.storageKey.endsWith('_person2') ? 2 : 1;
        isDone = matchCount >= personNum;
      } else {
        isDone = pool.some(d => docMatchesType(d.type, reqDoc.storageKey));
      }

      const icon = DOC_ICONS[baseKey] || '\u{1F4C4}';
      return {
        label: reqDoc.displayName,
        desc: reqDoc.description,
        icon,
        done: isDone,
      };
    });
  };

  // Sync local documents with context documents when context updates
  // Transform DocumentProofInfo (from context) to Document format (for progress calculation)
  useEffect(() => {
    if (contextDocuments && contextDocuments.length > 0) {
      const transformedDocs: Document[] = contextDocuments.map((doc) => ({
        id: String(doc.id),
        transactionId: doc.transactionId || '',
        // CRITICAL: docType from canister → type for progress calculator
        type: doc.docType || '',
        category: inferCategory(doc.docType || ''),
        name: doc.fileName || '',
        fileName: doc.fileName || '',
        fileSize: Number(doc.fileSize) || 0,
        mimeType: doc.contentType || '',
        uploadedBy: doc.uploadedBy || '',
        uploadedAt: (() => {
          if (!doc.uploadedAt) return new Date().toISOString();
          // Already an ISO string from getDocumentsByTransaction
          if (typeof doc.uploadedAt === 'string') return doc.uploadedAt;
          // BigInt nanoseconds from raw canister data
          return new Date(Number(doc.uploadedAt) / 1_000_000).toISOString();
        })(),
        status: doc.verified ? 'verified' : 'uploaded',
        required: true,
        hash: doc.fileHash || '',
      }));
      setTransactionDocuments(transformedDocs);
    } else {
      // CRITICAL: Clear documents when context is empty (e.g., after deletion)
      setTransactionDocuments([]);
    }
  }, [contextDocuments]);

  // Card progress is now status-based — no per-card document fetches needed.

  useEffect(() => {
    // ProtectedRoute handles auth redirect — just guard for missing principal
    if (!principalId || !isAuthenticated) {
      return;
    }

    // Check if user still needs onboarding (admin bypass)
    const needsOnboarding = localStorage.getItem('needsOnboarding') === 'true';
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    if (needsOnboarding && !onboardingComplete) {
      const isAdmin = isAdminPrincipal(principalId) || isAdminFromCanister;
      if (!isAdmin) {
        navigate('/onboarding/role');
        return;
      }
    }

    setUser({ principal: principalId });

    // Transactions are loaded by SplitPanelContext - no local fetch needed
    // Admin check is handled by PremiumSidebar component
    loadUserProfile();
  }, [principalId, isAuthenticated, navigate, isAdminFromCanister]);

  // Auto-select transaction from navigation state (e.g., after creating a new transaction)
  useEffect(() => {
    const state = location.state as { selectedTransactionId?: string; justCreated?: boolean } | null;
    if (state?.selectedTransactionId && transactions.length > 0) {
      const targetTransaction = transactions.find(t => t.id === state.selectedTransactionId);
      if (targetTransaction) {
        setSelectedTransaction(targetTransaction);
        setViewMode('detail');
        logger.info('📍 Dashboard: Auto-selected transaction from navigation state:', state.selectedTransactionId);
        // Clear the location state to prevent re-selection on refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, transactions]);

  // Auto-refresh documents when page becomes visible (e.g., after uploading docs)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && selectedTransaction) {
        logger.info('📡 Page visible - refreshing documents for progress update');
        await loadDocumentsForTransaction(selectedTransaction);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedTransaction]);

  // Sync listing data from chain for transactions missing local cache
  useEffect(() => {
    if (transactions.length === 0) return;
    transactions.forEach((tx) => {
      const txId = String(tx.id);
      if (!getRightmoveData(txId)) {
        syncListingFromChain(txId)
          .then((data) => {
            if (data) setListingSyncCount((c) => c + 1);
          })
          .catch(() => {});
      }
    });
  }, [transactions]);

  const loadUserProfile = async () => {
    try {
      const { icpService } = await import('../services/icp.service');
      await icpService.initialize();
      const profile = await icpService.getMyProfile();
      if (profile) {
        setUser((prev) => prev ? ({
          ...prev,
          name: profile.name,
          email: profile.email,
          userType: profile.userType
        }) : prev);
        // Admin status is handled by PremiumSidebar component (via useIsAdmin).
      }
    } catch (error) {
      logger.error('Error loading user profile:', error);
    }
  };

  // loadTransactions removed - transactions now loaded by SplitPanelContext

  // Handle transaction card click — navigate straight to the flow page
  // (archives the in-dashboard Seller Dashboard detail view)
  const handleTransactionClick = async (tx: Transaction) => {
    navigate(`/transaction/${tx.id}/flow`);
  };

  // Helper function to load documents (can be called to refresh)
  // Uses context refreshDocuments — context update triggers re-render automatically
  const loadDocumentsForTransaction = async (_tx: Transaction) => {
    try {
      await refreshDocuments();
      // Context update flows via useSplitPanel() → contextDocuments re-render
      // No need to copy to local state (stale closure would read old value)
    } catch (error) {
      logger.warn('Could not refresh documents:', error);
    }
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedTransaction(null);
    setTransactionDocuments([]);
    setViewMode('list');
  };

  // Display labels for the mode and transaction-type chips. CSS `capitalize`
  // mangles acronyms ("diy" -> "Diy"), so we map explicit values.
  const formatMode = (mode: string | undefined | null): string => {
    switch ((mode ?? '').toLowerCase()) {
      case 'diy': return 'DIY';
      case 'hybrid': return 'Hybrid';
      case 'professional': return 'Professional';
      case 'managed': return 'Managed';
      default: return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'DIY';
    }
  };

  const formatTransactionType = (type: string | undefined | null): string => {
    switch ((type ?? '').toLowerCase()) {
      case 'sale': return 'Sale';
      case 'purchase': return 'Purchase';
      case 'auction': return 'Auction';
      case 'remortgage': return 'Remortgage';
      default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Sale';
    }
  };

  // Get status label
  const getStatusLabel = (status: string): string =>
    isTransactionStatus(status) ? TRANSACTION_STATUS_LABEL[status] : status;

  // Calculate progress from transaction status and party presence only.
  // No canister calls — all data is already in the TX record.
  const getCardProgress = (tx: Transaction): number => {
    const status = tx.status as string;
    const ANON = '2vxsx-fae';
    const hasBuyer = tx.buyer && tx.buyer !== ANON && tx.buyer !== '';
    const hasSeller = tx.seller && tx.seller !== ANON && tx.seller !== '';

    // While active, use doc uploads to calculate progress (20–70% range)
    if (status === 'active') {
      // Use contextDocuments when this is the selected transaction
      const isSelected = selectedTransaction?.id === tx.id;
      if (isSelected && contextDocuments && contextDocuments.length > 0) {
        const docs = contextDocuments.map((d) => ({
          type: d.docType || '',
        }));
        const partyCounts = getPartyCountsForTransaction(tx.id);
        const sellerReq = getRequiredDocumentsForRole('seller', tx, partyCounts.sellerCount);
        const buyerReq = getRequiredDocumentsForRole('buyer', tx, partyCounts.buyerCount);
        const totalReq = sellerReq.length + buyerReq.length;
        const countDone = (reqs: typeof sellerReq): number =>
          reqs.filter(r => {
            const base = r.storageKey.replace(/_person[12]$/, '');
            const isVar = r.storageKey !== base;
            if (isVar) {
              const n = r.storageKey.endsWith('_person2') ? 2 : 1;
              return docs.filter(d => docMatchesType(d.type, base)).length >= n;
            }
            return docs.some(d => docMatchesType(d.type, r.storageKey));
          }).length;
        const uploaded = countDone(sellerReq) + countDone(buyerReq);
        const docPct = totalReq > 0 ? uploaded / totalReq : 0;
        const baseProgress = hasBuyer && hasSeller ? 20 : 10;
        const progress = Math.round(baseProgress + docPct * 50);
        // Cache for list view
        docProgressCache.current[tx.id] = progress;
        return progress;
      }

      // Fall back to cached progress from previous detail view visit
      if (docProgressCache.current[tx.id]) {
        return docProgressCache.current[tx.id];
      }

      if (hasBuyer && hasSeller) return 20;
      return 10;
    }

    return isTransactionStatus(status) ? TRANSACTION_STATUS_PROGRESS[status] : 10;
  };

  const handleJoinSuccess = (_transaction: Transaction) => {
    setShowJoinModal(false);
    // Reload transactions to include the newly joined one - use context refresh
    refreshTransactions();
  };

  // Property edit helper functions
  const getStoredPostcode = (transactionId: string): string | null => {
    const stored = localStorage.getItem(`tx_postcode_${transactionId}`);
    return stored || null;
  };

  const savePostcode = (transactionId: string, postcode: string) => {
    localStorage.setItem(`tx_postcode_${transactionId}`, postcode.toUpperCase());
    logger.info('Saved postcode for transaction:', { transactionId, postcode });
  };

  const handleOpenEditModal = () => {
    if (selectedTransaction) {
      // Pre-fill with existing postcode (from transaction, localStorage, or empty)
      const txPostcode = selectedTransaction.postcode;
      const storedPostcode = getStoredPostcode(selectedTransaction.id);
      setEditPostcode(storedPostcode || txPostcode || '');
      setShowPropertyEditModal(true);
    }
  };

  const handleSavePropertyEdit = () => {
    if (selectedTransaction && editPostcode.trim()) {
      savePostcode(selectedTransaction.id, editPostcode.trim());
      setShowPropertyEditModal(false);
      // Force re-render by refreshing transactions
      refreshTransactions();
    }
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (): Promise<void> => {
    if (!deleteTargetTransaction) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { icpService } = await import('../services/icp.service');
      await icpService.initialize();
      const result = await icpService.deleteTransactionFromCanister(deleteTargetTransaction.id);
      if (result.ok) {
        setShowDeleteConfirmModal(false);
        setDeleteTargetTransaction(null);
        // Clear selected transaction if it was the deleted one
        if (selectedTransaction?.id === deleteTargetTransaction.id) {
          setSelectedTransaction(null);
          setViewMode('list');
        }
        await refreshTransactions();
      } else {
        setDeleteError(result.error || 'Failed to delete transaction');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Leave transaction handler — called by buyers / non-creators who joined
  // via invite code and want out. Canister path is leaveTransaction (not
  // deleteTransaction), which removes the caller from accessList and — if
  // they were the assigned buyer — resets the buyer slot so the invite
  // code is reusable.
  const handleLeaveTransaction = async (): Promise<void> => {
    if (!leaveTargetTransaction) return;
    setIsLeaving(true);
    setLeaveError(null);
    try {
      const { icpService } = await import('../services/icp.service');
      await icpService.initialize();
      await icpService.leaveTransaction(leaveTargetTransaction.id);
      setShowLeaveConfirmModal(false);
      setLeaveTargetTransaction(null);
      if (selectedTransaction?.id === leaveTargetTransaction.id) {
        setSelectedTransaction(null);
        setViewMode('list');
      }
      await refreshTransactions();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLeaving(false);
    }
  };

  // Helper to get effective postcode (localStorage override > transaction postcode > extracted from address)
  const getEffectivePostcode = (tx: Transaction): string | null => {
    const storedPostcode = getStoredPostcode(tx.id);
    if (storedPostcode) return storedPostcode;

    const txPostcode = tx.postcode;
    if (txPostcode) return txPostcode;

    const addressString = tx.propertyAddress || '';
    const postcodeMatch = addressString.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
    return postcodeMatch ? postcodeMatch[0].toUpperCase() : null;
  };

  // Handle ICP timestamps (BigInt in nanoseconds) and various date formats
  const formatCreatedDate = (timestamp: string | number | bigint | undefined): string => {
    if (!timestamp) return 'No date';
    try {
      if (typeof timestamp === 'bigint') {
        return new Date(Number(timestamp / BigInt(1_000_000))).toLocaleDateString();
      }
      if (typeof timestamp === 'number') {
        const ms = timestamp > 1e15 ? timestamp / 1_000_000 : timestamp;
        return new Date(ms).toLocaleDateString();
      }
      if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString();
        const numValue = parseInt(timestamp, 10);
        if (!isNaN(numValue)) {
          const ms = numValue > 1e15 ? numValue / 1_000_000 : numValue;
          return new Date(ms).toLocaleDateString();
        }
      }
      return 'Invalid date';
    } catch {
      return 'Invalid date';
    }
  };

  const sellingCount = transactions.filter((tx) => getUserRole(tx) === 'seller').length;
  const buyingCount = transactions.length - sellingCount;
  const visibleTransactions = roleFilter === 'all'
    ? transactions
    : transactions.filter((tx) => getUserRole(tx) === roleFilter);

  const roleFilters: Array<{ key: 'all' | 'seller' | 'buyer'; label: string; count: number }> = [
    { key: 'all', label: 'All', count: transactions.length },
    { key: 'seller', label: 'Selling', count: sellingCount },
    { key: 'buyer', label: 'Buying', count: buyingCount },
  ];

  const isListView = viewMode === 'list';

  return (
    <div>
      <PortalShell
        sections={DASHBOARD_SECTIONS}
        portalName="Dashboard"
        topBar={{
          title: isListView ? 'My transactions' : (selectedTransaction?.propertyAddress || 'Transaction'),
          subtitle: isListView
            ? `Welcome back, ${displayName}`
            : [
                selectedTransaction && getUserRole(selectedTransaction),
                selectedTransaction && `Ref #${selectedTransaction.id.slice(0, 12)}`,
              ].filter(Boolean).join(' · '),
          onBack: isListView ? undefined : handleBackToList,
          backLabel: 'All transactions',
          displayNameOverride: displayName,
          isAdmin: isAdminFromCanister,
        }}
      >
        {/* Detail-view actions. The bar carries navigation only. */}
        {!isListView && selectedTransaction && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              className="share-btn text-xs sm:text-sm"
              onClick={() => navigate(`/transaction/${selectedTransaction.id}/flow`)}
            >
              Searches
            </button>
            <button
              className="share-btn text-xs sm:text-sm"
              onClick={() => navigate(`/transaction/${selectedTransaction.id}/share`)}
            >
              Share / Invite
            </button>
            <button
              className="share-btn text-xs sm:text-sm"
              onClick={() => navigate(`/transaction/${selectedTransaction.id}/flow`)}
            >
              Open transaction flow
            </button>
          </div>
        )}

        {/* LIST VIEW - All Transactions */}
        {isListView && (
          <section className="flex flex-col gap-6">
            {/* TOOLBAR — role filters on the left, the two transaction actions
                on the right. Replaces the sidebar's transaction buttons. */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:gap-2 sm:overflow-visible sm:px-0">
                {roleFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setRoleFilter(filter.key)}
                    aria-pressed={roleFilter === filter.key}
                    className={
                      roleFilter === filter.key
                        ? 'inline-flex h-8 shrink-0 items-center rounded-full border border-transparent bg-[var(--text-main)] px-3 text-[13px] font-medium text-[var(--bg-card)] transition-colors duration-200 ease-out'
                        : 'inline-flex h-8 shrink-0 items-center rounded-full border border-[var(--border-color)] bg-transparent px-3 text-[13px] text-[var(--text-secondary)] transition-colors duration-200 ease-out hover:text-[var(--text-main)] sm:border-transparent'
                    }
                  >
                    {filter.label} {filter.count}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/join')}
                  className="flex h-11 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-200 ease-out hover:border-[#0D9488] hover:text-[#0D9488] dark:hover:border-[#14B8A6] dark:hover:text-[#14B8A6]"
                >
                  <Link2 size={18} strokeWidth={2} />
                  Join transaction
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/start-transaction')}
                  className="hidden h-11 items-center gap-2 rounded-lg border-none bg-[#0D9488] px-[18px] text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#0F766E] sm:flex"
                >
                  <Plus size={18} strokeWidth={2} />
                  Start transaction
                </button>
              </div>
            </div>

            {/* Transaction cards. With none to show, the toolbar's Start and
                Join buttons carry the CTA, so only the demo property remains. */}
            {transactions.length === 0 ? (
              showDemoProperty && <DemoPropertyCard onDismiss={handleDemoDismiss} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5" data-sync={listingSyncCount}>
                {visibleTransactions.map((tx) => {
                  const role = getUserRole(tx);
                  return (
                    <TransactionListCard
                      key={tx.id}
                      id={tx.id}
                      address={tx.propertyAddress || ''}
                      amount={tx.amount || 0}
                      status={tx.status as string}
                      statusLabel={getStatusLabel(tx.status)}
                      progress={getCardProgress(tx)}
                      role={role}
                      createdDate={formatCreatedDate(tx.createdAt)}
                      modeLabel={formatMode(tx.mode)}
                      typeLabel={formatTransactionType(tx.transactionType)}
                      listing={getRightmoveData(String(tx.id))}
                      onOpen={() => handleTransactionClick(tx)}
                      onEdit={() => {
                        setSelectedTransaction(tx);
                        setEditPostcode(getStoredPostcode(tx.id) || tx.postcode || '');
                        setShowPropertyEditModal(true);
                      }}
                      onRemove={() => {
                        // Sellers created the transaction, so they delete it.
                        // Buyers joined by invite — the canister rejects a
                        // delete from them, so they leave instead.
                        if (role === 'seller') {
                          setDeleteTargetTransaction(tx);
                          setDeleteError(null);
                          setShowDeleteConfirmModal(true);
                        } else {
                          setLeaveTargetTransaction(tx);
                          setLeaveError(null);
                          setShowLeaveConfirmModal(true);
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* Mobile keeps the primary CTA reachable without scrolling to the
                foot of the list; the desktop toolbar carries it instead. */}
            {transactions.length > 0 && (
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 pb-4 pt-3 sm:hidden">
                <button
                  type="button"
                  onClick={() => navigate('/start-transaction')}
                  className="h-12 w-full rounded-lg border-none bg-[#0D9488] text-[15px] font-medium text-white transition-colors duration-200 ease-out hover:bg-[#0F766E]"
                >
                  Start a transaction
                </button>
              </div>
            )}
          </section>
        )}

        {/* DETAIL VIEW - Selected Transaction */}
        {viewMode === 'detail' && selectedTransaction && (
          <>
            {/* What to do next on THIS transaction. Floats centred on open,
                then gets out of the way: minimise leaves the icon that sits
                here at the top-right, close leaves nothing. Either way it
                returns by itself once the blocker moves on. */}
            <div className="mb-2 sm:mb-3 min-h-11">
              <NextStepCard
                txId={String(selectedTransaction.id)}
                variant="full"
                presentation="overlay"
                refreshKey={listingSyncCount}
                onAction={(action) => navigate(action)}
              />
            </div>

            {/* HEADER - Property Card with Rightmove branding (or plain header fallback) */}
            {(() => {
              const detailRm = getRightmoveData(String(selectedTransaction.id));
              const role = getUserRole(selectedTransaction);

              // Optional chain, not just a truthiness check on detailRm: this
              // is localStorage data that may predate the worker emitting the
              // key, so `images` can be undefined on an otherwise valid record.
              if (detailRm && detailRm.images?.length) {
                return (
                  <section className="card !p-0 overflow-hidden mb-4 sm:mb-6">
                    <div className="flex flex-col md:flex-row">
                      {/* Hero Image */}
                      <div className="relative md:w-2/5 h-48 md:h-auto min-h-[200px]">
                        <img
                          src={detailRm.images[0].url}
                          alt={detailRm.address}
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute top-3 left-3 px-3 py-1 rounded text-xs font-bold tracking-wide ${detailRm.source === 'purplebricks' ? 'bg-[#550099] text-white' : 'bg-[#00DEB6] text-[#2B2B2B]'}`}>
                          {detailRm.source === 'purplebricks' ? 'purplebricks' : 'rightmove'}
                        </div>
                        {detailRm.images.length > 1 && (
                          <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs">
                            1/{detailRm.images.length} photos
                          </div>
                        )}
                      </div>

                      {/* Property Details */}
                      <div className="flex-1 p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h2 className="text-[var(--text-main)] text-lg sm:text-2xl m-0 break-words">
                              {detailRm.address}
                            </h2>
                            <span className={`${role === 'seller' ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'} border px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold capitalize whitespace-nowrap`}>
                              {role === 'seller' ? 'Selling' : 'Buying'}
                            </span>
                          </div>
                          <button
                            onClick={handleOpenEditModal}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors shrink-0"
                            title="Edit property details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        </div>

                        <p className="text-[var(--text-main)] text-xl sm:text-2xl font-bold mb-1">
                          £{detailRm.price.toLocaleString()}
                        </p>
                        {detailRm.priceQualifier && (
                          <span className="text-[var(--text-muted)] text-xs uppercase">{detailRm.priceQualifier}</span>
                        )}

                        {/* Property stats */}
                        <div className="flex flex-wrap gap-3 mt-3 mb-3 text-sm text-[var(--text-secondary)]">
                          {detailRm.propertyType && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                              {detailRm.propertyType}
                            </span>
                          )}
                          {detailRm.bedrooms > 0 && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                              {detailRm.bedrooms} bed
                            </span>
                          )}
                          {detailRm.bathrooms > 0 && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                              {detailRm.bathrooms} bath
                            </span>
                          )}
                          {detailRm.tenure !== 'unknown' && (
                            <span className="bg-[var(--bg-section)] px-2 py-0.5 rounded text-xs capitalize">{detailRm.tenure}</span>
                          )}
                          {getEffectivePostcode(selectedTransaction) && (
                            <span className="px-2 py-0.5 bg-stone-200 dark:bg-gray-700 rounded text-xs font-mono">
                              {getEffectivePostcode(selectedTransaction)}
                            </span>
                          )}
                        </div>

                        {/* Key features */}
                        {detailRm.keyFeatures?.length ? (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {detailRm.keyFeatures.slice(0, 4).map((feature, i) => (
                              <span key={i} className="bg-[var(--bg-section)] text-[var(--text-secondary)] px-2 py-1 rounded text-xs">
                                {feature}
                              </span>
                            ))}
                            {detailRm.keyFeatures.length > 4 && (
                              <span className="text-[var(--text-muted)] text-xs py-1">+{detailRm.keyFeatures.length - 4} more</span>
                            )}
                          </div>
                        ) : null}

                        {/* Agent info */}
                        <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)]">
                          {detailRm.agentLogoUrl && (
                            <img src={detailRm.agentLogoUrl} alt={detailRm.agentName} className="h-6 object-contain" />
                          )}
                          <span className="text-[var(--text-muted)] text-xs">
                            {detailRm.agentName}{detailRm.agentBranch ? `, ${detailRm.agentBranch}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              }

              // Fallback: plain header with Rightmove import option
              return (
                <section className="progress-section mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                        <h2 className="text-[var(--text-main)] text-lg sm:text-2xl m-0 break-words">
                          {selectedTransaction.propertyAddress}
                        </h2>
                        <span className={`${role === 'seller' ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'} border px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold capitalize whitespace-nowrap`}>
                          {role === 'seller' ? 'Selling' : 'Buying'}
                        </span>
                      </div>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm mt-1">
                        £{(selectedTransaction.amount || 0).toLocaleString()} • {getStatusLabel(selectedTransaction.status)}
                        {getEffectivePostcode(selectedTransaction) && (
                          <span className="ml-2 px-2 py-0.5 bg-stone-200 dark:bg-gray-700 rounded text-xs font-mono">
                            {getEffectivePostcode(selectedTransaction)}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={handleOpenEditModal}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors shrink-0 self-start"
                      title="Edit property details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                </section>
              );
            })()}

            {/* Solicitor Card — shown above Exchange Readiness */}
            {selectedTransaction && (() => {
              const tx = selectedTransaction as unknown as Record<string, unknown>;
              const buyerSolicitor = tx['buyerSolicitor'] ?? null;
              const sellerSolicitor = tx['sellerSolicitor'] ?? null;
              const solicitor = (buyerSolicitor || sellerSolicitor) as import('../types/solicitor.types').SolicitorRecord | null;
              return (
                <div className="mb-4 sm:mb-6">
                  <SolicitorCard
                    solicitor={solicitor}
                    isPending={false}
                    onInvite={() => setShowInviteForSolicitor(true)}
                    onViewLegalTab={undefined}
                  />
                </div>
              );
            })()}

            {/* Exchange Readiness Progress Bar — full width above the grid */}
            {selectedTransaction && (() => {
              const partyCounts = getPartyCountsForTransaction(selectedTransaction.id);

              // Count required docs for BOTH sides
              const sellerRequired = getRequiredDocumentsForRole('seller', selectedTransaction, partyCounts.sellerCount);
              const buyerRequired = getRequiredDocumentsForRole('buyer', selectedTransaction, partyCounts.buyerCount);
              const totalRequired = sellerRequired.length + buyerRequired.length;

              // Use contextDocuments directly (fresh from canister via SplitPanel context)
              // Each doc has docType (canister field) — match against equivalence groups
              const validDocs = (contextDocuments || []).map((d) => ({
                type: d.docType || '',
                uploadedBy: d.uploadedBy?.toString?.() || d.uploadedBy || '',
              }));

              // Match uploaded docs against required using equivalence groups
              const countUploaded = (requiredDocs: typeof sellerRequired): number => {
                return requiredDocs.filter(reqDoc => {
                  const baseKey = reqDoc.storageKey.replace(/_person[12]$/, '');
                  const isPersonVariant = reqDoc.storageKey !== baseKey;
                  if (isPersonVariant) {
                    const matchCount = validDocs.filter(d => docMatchesType(d.type, baseKey)).length;
                    const personNum = reqDoc.storageKey.endsWith('_person2') ? 2 : 1;
                    return matchCount >= personNum;
                  }
                  return validDocs.some(d => docMatchesType(d.type, reqDoc.storageKey));
                }).length;
              };

              const totalUploaded = countUploaded(sellerRequired) + countUploaded(buyerRequired);
              const pct = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0;
              const isReady = pct === 100;

              return (
                <div className={`rounded-xl p-5 border mb-4 sm:mb-6 ${
                  isReady
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-stone-100 dark:bg-gray-800 border-stone-300 dark:border-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-base font-semibold flex items-center gap-2 ${
                      isReady ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      <span>{isReady ? '\u2728' : '\u{1F4CA}'}</span>
                      Exchange Readiness
                    </h3>
                    <span className={`text-base font-bold ${
                      isReady ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3.5 overflow-hidden">
                    <div
                      className={`h-3.5 rounded-full transition-all duration-500 ${
                        isReady ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-sm mt-2 ${
                    isReady ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {isReady
                      ? 'All required documents uploaded. Ready to proceed to exchange.'
                      : `${totalUploaded} of ${totalRequired} required documents uploaded.`}
                  </p>
                  {isReady && (
                    <button
                      onClick={() => navigate(`/exchange/${selectedTransaction.id}`)}
                      className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
                    >
                      Proceed to Exchange {'\u2192'}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* ROLE-AWARE LAYOUT - Different views for buyer vs seller */}
            <div className="detail-view-grid grid grid-cols-1 lg:grid-cols-[minmax(0,500px)_1fr] gap-4 sm:gap-6">
              {/* LEFT COLUMN - Role-dependent content */}
              <div className="flex flex-col gap-4 sm:gap-5">

                {/* ============ SELLER LEFT COLUMN ============ */}
                {getUserRole(selectedTransaction) === 'seller' && (
                  <>
                    {/* Seller To-Do Checklist (dynamic, multi-party aware) */}
                    <div className="bg-stone-100 dark:bg-gray-800 rounded-xl p-5 border border-stone-300 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Your To-Do List
                      </h3>
                      <div className="space-y-3">
                        {buildChecklist('seller', selectedTransaction, contextDocuments).map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-stone-200 dark:bg-gray-900 rounded-lg">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              item.done ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700'
                            }`}>
                              {item.done ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{i + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${item.done ? 'text-green-600 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                            </div>
                            <span className="text-base">{item.icon}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* HM Land Registry Quick Links - Seller only */}
                    {(() => {
                      const extractedPostcode = getEffectivePostcode(selectedTransaction);
                      return (
                        <div className="bg-stone-100 dark:bg-gray-800 rounded-xl p-5 border border-stone-300 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              HM Land Registry
                            </h3>
                            {extractedPostcode && (
                              <span className="text-sm text-gray-500 dark:text-gray-400 bg-stone-200 dark:bg-gray-900 px-3 py-1 rounded-full font-mono">
                                {extractedPostcode}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <a href={LAND_REGISTRY_URLS.titleSearch} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 p-4 bg-stone-200 dark:bg-gray-900 hover:bg-stone-300 dark:hover:bg-gray-700 rounded-lg transition-colors group">
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">Title Search</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">£3 per search</p>
                              </div>
                            </a>
                            <a href={LAND_REGISTRY_URLS.officialCopies} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 p-4 bg-stone-200 dark:bg-gray-900 hover:bg-stone-300 dark:hover:bg-gray-700 rounded-lg transition-colors group">
                              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-300 transition-colors">Official Copy</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">£7 per document</p>
                              </div>
                            </a>
                            <a href={LAND_REGISTRY_URLS.pricePaidSearch} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 p-4 bg-stone-200 dark:bg-gray-900 hover:bg-stone-300 dark:hover:bg-gray-700 rounded-lg transition-colors group">
                              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-300 transition-colors">Price Paid Data</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Free - All sales</p>
                              </div>
                            </a>
                            <a href={LAND_REGISTRY_URLS.createAccount} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 p-4 bg-stone-200 dark:bg-gray-900 hover:bg-stone-300 dark:hover:bg-gray-700 rounded-lg transition-colors group">
                              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">Create Account</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">For paid services</p>
                              </div>
                            </a>
                          </div>
                          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                            Title searches and official copies require a Land Registry account. Price Paid Data is free and shows historical sale prices.
                          </p>
                        </div>
                      );
                    })()}

                    {/* Land Registry Price History Card - Seller only */}
                    {(() => {
                      const ta6Data = selectedTransaction.ta6Data || selectedTransaction.wizardData?.ta6Data;
                      const landRegistryData = ta6Data?.landRegistryData;
                      const propertyAddress = ta6Data?.propertyAddress;

                      if (landRegistryData?.priceHistory?.length > 0 ||
                          (propertyAddress && typeof propertyAddress === 'object' && propertyAddress.postcode)) {
                        return (
                          <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <PropertyPriceHistory
                              exactMatches={landRegistryData?.exactMatches}
                              areaHistory={landRegistryData?.priceHistory}
                              propertyAddress={typeof propertyAddress === 'object' ? propertyAddress as LandRegistryAddress : undefined}
                              compact={true}
                              showAreaComparison={true}
                              darkMode={isDark}
                            />
                          </div>
                        );
                      }

                      const finalPostcode = getEffectivePostcode(selectedTransaction);
                      if (finalPostcode) {
                        const minimalAddress: LandRegistryAddress = {
                          paon: '', saon: '', street: '', locality: '',
                          townCity: '', district: '', county: '',
                          postcode: finalPostcode, propertyType: '',
                          newBuild: false, tenure: ''
                        };
                        return (
                          <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <PropertyPriceHistory
                              propertyAddress={minimalAddress}
                              compact={true}
                              showAreaComparison={true}
                              darkMode={isDark}
                            />
                          </div>
                        );
                      }

                      return (
                        <div className="bg-stone-100 dark:bg-slate-800 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 style={{ color: 'var(--text-main)', fontSize: '16px', margin: 0 }}>Land Registry</h3>
                            <button
                              onClick={handleOpenEditModal}
                              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                            >
                              Add Postcode
                            </button>
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                            No postcode found. Land Registry data will appear here when available.
                          </p>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ============ BUYER LEFT COLUMN ============ */}
                {getUserRole(selectedTransaction) === 'buyer' && (
                  <>
                    {/* What You Need To Do - Buyer guidance (dynamic, multi-party aware) */}
                    <div className="bg-stone-100 dark:bg-gray-800 rounded-xl p-5 border border-stone-300 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Your To-Do List
                      </h3>
                      <div className="space-y-3">
                        {[
                          ...buildChecklist('buyer', selectedTransaction, contextDocuments),
                          { label: 'Review seller\'s property forms', desc: 'Check TA6 and TA10 in the tabs', icon: '\u{1F4CB}', done: false },
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-stone-200 dark:bg-gray-900 rounded-lg">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              item.done ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700'
                            }`}>
                              {item.done ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{i + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${item.done ? 'text-green-600 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                            </div>
                            <span className="text-base">{item.icon}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Seller's Progress section removed - to be reimplemented */}
                  </>
                )}

              </div>

              {/* RIGHT COLUMN - Tabs (Checklist, Documents, Chain, Activity) */}
              <div id="checklist-tab-content">
                {/* New document badge indicator */}
                {selectedTransaction && contextDocuments.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-400">Documents</span>
                    <NewDocumentBadge
                      count={getNewDocumentCount(
                        selectedTransaction.id,
                        contextDocuments.map((d) => d.id)
                      )}
                      position="inline"
                    />
                  </div>
                )}

                <TransactionDetailTabs
                  transaction={selectedTransaction}
                  onDocumentUploaded={async (doc) => {
                    logger.info('Document uploaded, updating progress:', doc);
                    // Add document to local state immediately for progress bar update
                    setTransactionDocuments(prev => {
                      // Avoid duplicates
                      if (prev.some(d => d.id === doc.id)) return prev;
                      return [...prev, doc];
                    });
                    // Also refresh from context for full sync
                    await refreshDocuments();
                  }}
                />
              </div>
            </div>
          </>
        )}
      </PortalShell>

      {/* Join Transaction Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <TransactionInvite
              onJoinSuccess={handleJoinSuccess}
              onClose={() => setShowJoinModal(false)}
            />
          </div>
        </div>
      )}

      {/* Solicitor Share Modal */}
      {showInviteForSolicitor && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md border border-stone-300 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800 dark:text-white">Invite Solicitor / Conveyancer</h3>
              <button onClick={() => setShowInviteForSolicitor(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-white text-xl">&times;</button>
            </div>
            <p className="text-sm text-stone-500 dark:text-gray-400 mb-4">Share this invite code with your solicitor or conveyancer so they can join the transaction.</p>
            <div className="bg-stone-100 dark:bg-gray-900 rounded-lg p-4 text-center mb-4">
              <div className="text-2xl font-mono font-bold text-stone-800 dark:text-white tracking-wider">{(selectedTransaction as unknown as Record<string, unknown>).inviteCode as string || selectedTransaction.id}</div>
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  const code = (selectedTransaction as unknown as Record<string, unknown>).inviteCode as string || selectedTransaction.id;
                  navigator.clipboard.writeText(code);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Copy Code
              </button>
              <button
                onClick={() => {
                  const code = (selectedTransaction as unknown as Record<string, unknown>).inviteCode as string || selectedTransaction.id;
                  const link = `${window.location.origin}/join-transaction?code=${code}`;
                  navigator.clipboard.writeText(link);
                }}
                className="flex-1 px-4 py-2 bg-stone-200 dark:bg-gray-700 text-stone-700 dark:text-gray-300 rounded-lg text-sm hover:bg-stone-300 dark:hover:bg-gray-600"
              >
                Copy Link
              </button>
            </div>
            <div className="text-xs text-stone-400 dark:text-gray-500 leading-relaxed">
              Your solicitor will use this code to join the transaction and complete the onboarding process (credential verification, task pricing, and consent).
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <WelcomeCards isOpen={showWelcomeCards} onClose={handleWelcomeClose} />

      {showDeleteConfirmModal && deleteTargetTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm border border-stone-300 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Transaction?</h3>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1 font-medium">
              {deleteTargetTransaction.propertyAddress || 'Unnamed property'}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              This action cannot be undone. The transaction and its data will be permanently removed.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteTargetTransaction(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTransaction}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal — buyer/non-creator removing themselves */}
      {showLeaveConfirmModal && leaveTargetTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm border border-stone-300 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Leave Transaction?</h3>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1 font-medium">
              {leaveTargetTransaction.propertyAddress || 'Unnamed property'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              You&apos;ll be removed from this transaction. The seller keeps it on their dashboard.
              If you were the assigned buyer, the invite code becomes reusable for a new joiner.
            </p>

            {leaveError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{leaveError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirmModal(false);
                  setLeaveTargetTransaction(null);
                  setLeaveError(null);
                }}
                disabled={isLeaving}
                className="flex-1 px-4 py-2 bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveTransaction}
                disabled={isLeaving}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLeaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Leaving...
                  </>
                ) : (
                  'Leave'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Edit Modal */}
      {showPropertyEditModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-stone-300 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Property Details</h3>
              <button
                onClick={() => setShowPropertyEditModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Property Address (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Property Address</label>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-stone-100 dark:bg-gray-900 rounded-lg px-3 py-2">
                  {selectedTransaction.propertyAddress}
                </p>
              </div>

              {/* Postcode (editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Postcode</label>
                <input
                  type="text"
                  value={editPostcode}
                  onChange={(e) => setEditPostcode(e.target.value.toUpperCase())}
                  placeholder="e.g., SW1A 1AA"
                  className="w-full px-3 py-2 bg-stone-100 dark:bg-gray-900 border border-stone-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Enter a valid UK postcode to enable Land Registry price history lookup
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPropertyEditModal(false)}
                className="flex-1 px-4 py-2 bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePropertyEdit}
                disabled={!editPostcode.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/**
 * Dashboard_Premium - Premium dashboard with Oscar AI assistant
 * Wraps content with SplitPanelProvider for shared transaction state
 */
const Dashboard_Premium: React.FC = () => {
  return (
    <SplitPanelProvider>
      <Dashboard_PremiumContent />
    </SplitPanelProvider>
  );
};

export default Dashboard_Premium;
