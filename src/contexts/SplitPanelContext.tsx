// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
/**
 * Split Panel Context
 * Provides shared state for the Oscar dashboard split-panel layout
 * Manages selectedTransaction, activeContext, and userRole state
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  SplitPanelState,
  SplitPanelAction,
  SplitPanelContextType,
  ConversationContext,
  SimplifiedRole,
  DocumentProofInfo,
} from '../types/splitPanel.types';
import type { Transaction } from '../types/transaction.types';
import { mapUserTypeToRole } from '../utils/roleMapping';
import { useAuthStore } from '../stores/authStore';
import { icpService } from '../services/icp.service';
import { hiddenDocumentStatuses } from '@/lib/documentStatus';
import { logger } from '../utils/logger';

/**
 * Polling interval for document updates (30 seconds)
 */
// Each poll is two canister update calls of about two seconds each. Uploads made
// in this tab refresh at once, so this only sets how soon another party's shows.
const DOCUMENT_POLL_INTERVAL = 60000;

/**
 * Initial state for the split panel
 */
const initialState: SplitPanelState = {
  selectedTransaction: null,
  activeContext: null,
  userRole: null,
  transactions: [],
  transactionsLoading: false,
  transactionsError: null,
  transactionDocuments: [],
  hiddenDocumentStatus: [],
  documentsLoading: false,
  documentsError: null,
  documentsLastUpdated: null,
};

/**
 * Reducer function for split panel state management
 */
function splitPanelReducer(
  state: SplitPanelState,
  action: SplitPanelAction
): SplitPanelState {
  switch (action.type) {
    case 'SET_TRANSACTION':
      return {
        ...state,
        selectedTransaction: action.payload,
      };
    case 'SET_CONTEXT':
      return {
        ...state,
        activeContext: action.payload,
      };
    case 'SET_ROLE':
      return {
        ...state,
        userRole: action.payload,
      };
    case 'CLEAR_CONTEXT':
      return {
        ...state,
        activeContext: null,
      };
    case 'SET_TRANSACTIONS':
      return {
        ...state,
        transactions: action.payload,
      };
    case 'SET_TRANSACTIONS_LOADING':
      return {
        ...state,
        transactionsLoading: action.payload,
      };
    case 'SET_TRANSACTIONS_ERROR':
      return {
        ...state,
        transactionsError: action.payload,
      };
    case 'REFRESH_TRANSACTIONS':
      return {
        ...state,
        transactionsLoading: true,
        transactionsError: null,
      };
    case 'SET_DOCUMENTS':
      return {
        ...state,
        transactionDocuments: action.payload,
      };
    case 'SET_DOCUMENTS_LOADING':
      return {
        ...state,
        documentsLoading: action.payload,
      };
    case 'SET_HIDDEN_DOCUMENT_STATUS':
      return {
        ...state,
        hiddenDocumentStatus: action.payload,
      };
    case 'SET_DOCUMENTS_ERROR':
      return {
        ...state,
        documentsError: action.payload,
      };
    case 'SET_DOCUMENTS_LAST_UPDATED':
      return {
        ...state,
        documentsLastUpdated: action.payload,
      };
    default:
      return state;
  }
}

/**
 * Context for split panel state
 * Exported for testing purposes
 */
export const SplitPanelContext = createContext<SplitPanelContextType | undefined>(
  undefined
);

/**
 * Props for SplitPanelProvider
 */
interface SplitPanelProviderProps {
  children: ReactNode;
}

/**
 * Provider component for split panel state
 *
 * Provides:
 * - selectedTransaction: Currently selected transaction for detail view
 * - activeContext: Current conversation context for Oscar AI
 * - userRole: Simplified role derived from auth store (buyer/seller/solicitor)
 * - Action functions to update state
 *
 * @example
 * ```tsx
 * <SplitPanelProvider>
 *   <OscarDashboard />
 * </SplitPanelProvider>
 * ```
 */
export const SplitPanelProvider: React.FC<SplitPanelProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(splitPanelReducer, initialState);

  // Get userProfile from auth store
  const userProfile = useAuthStore((state) => state.userProfile);

  // Derive userRole from userProfile.userType
  const userRole: SimplifiedRole = useMemo(() => {
    return mapUserTypeToRole(userProfile?.userType);
  }, [userProfile?.userType]);

  // Memoized action functions
  const setSelectedTransaction = useCallback((transaction: Transaction | null) => {
    dispatch({ type: 'SET_TRANSACTION', payload: transaction });
  }, []);

  const setActiveContext = useCallback((context: ConversationContext | null) => {
    dispatch({ type: 'SET_CONTEXT', payload: context });
  }, []);

  const clearContext = useCallback(() => {
    dispatch({ type: 'CLEAR_CONTEXT' });
  }, []);

  // Load transactions from blockchain - CRITICAL: empty dependency array to prevent infinite re-renders
  const loadTransactions = useCallback(async () => {
    const { principalId } = useAuthStore.getState();
    if (!principalId) return;

    dispatch({ type: 'SET_TRANSACTIONS_LOADING', payload: true });

    try {
      // Use initAuth() to ensure authenticated agent (not anonymous)
      await icpService.initAuth();
      // getMyTransactions() filters server-side by msg.caller — no client-side filter needed
      const userTxs = await icpService.getMyTransactions();

      logger.info('SplitPanelContext: loaded', userTxs.length, 'transactions for principal', principalId);
      dispatch({ type: 'SET_TRANSACTIONS', payload: userTxs as Transaction[] });
      dispatch({ type: 'SET_TRANSACTIONS_ERROR', payload: null });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions';
      dispatch({ type: 'SET_TRANSACTIONS_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_TRANSACTIONS_LOADING', payload: false });
    }
  }, []); // EMPTY DEPENDENCY ARRAY - dispatch is stable from useReducer

  // Refresh transactions function exposed via context
  const refreshTransactions = useCallback(async () => {
    await loadTransactions();
  }, [loadTransactions]);

  // Load transactions when auth is ready (principalId available)
  const principalId = useAuthStore((s) => s.principalId);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  useEffect(() => {
    if (isInitialized && principalId) {
      loadTransactions();
    }
  }, [isInitialized, principalId, loadTransactions]);

  // Ref for document polling interval - prevents stale closure issues
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reads take seconds, so a reply can land after the user has moved to another deal.
  const selectedTransactionIdRef = useRef<string | null>(null);

  // Load documents for a transaction - CRITICAL: empty dependency array to prevent infinite re-renders
  const loadDocuments = useCallback(async (transactionId: string) => {
    const isSelected = (): boolean => selectedTransactionIdRef.current === transactionId;
    dispatch({ type: 'SET_DOCUMENTS_LOADING', payload: true });
    try {
      await icpService.ensureDocumentStorageActor();

      // Verify method exists before calling - prevents runtime errors
      if (typeof icpService.fetchTransactionDocuments !== 'function') {
        logger.error('icpService.fetchTransactionDocuments is not available');
        dispatch({ type: 'SET_DOCUMENTS_ERROR', payload: 'Document service unavailable' });
        return;
      }

      // A failed status read must not take down the document list: the status
      // lines and ticks just keep their last value until the next poll.
      const [docs, status] = await Promise.all([
        icpService.fetchTransactionDocuments(transactionId),
        icpService.getDocumentStatus(transactionId).catch((error: unknown) => {
          logger.warn('Could not load document status:', error);
          return null;
        }),
      ]);
      if (!isSelected()) return;

      // Transform to DocumentProofInfo (Principal to string for display)
      const transformedDocs = (docs || []).map((doc) => ({
        ...doc,
        uploadedBy: doc.uploadedBy?.toText?.() || doc.uploadedBy?.toString?.() || doc.uploadedBy,
        transactionId: doc.transactionId?.[0] || null,
      })) as unknown as DocumentProofInfo[];

      dispatch({ type: 'SET_DOCUMENTS', payload: transformedDocs });
      if (status) {
        dispatch({
          type: 'SET_HIDDEN_DOCUMENT_STATUS',
          payload: hiddenDocumentStatuses(status, (docs || []).map((doc) => String(doc.uploadedAt))),
        });
      }
      dispatch({ type: 'SET_DOCUMENTS_LAST_UPDATED', payload: Date.now() });
      dispatch({ type: 'SET_DOCUMENTS_ERROR', payload: null });
    } catch (error: unknown) {
      if (!isSelected()) return;
      const msg = error instanceof Error ? error.message : 'Failed to load documents';
      dispatch({ type: 'SET_DOCUMENTS_ERROR', payload: msg });
    } finally {
      if (isSelected()) dispatch({ type: 'SET_DOCUMENTS_LOADING', payload: false });
    }
  }, []); // EMPTY DEPENDENCY ARRAY - dispatch is stable from useReducer

  // Refresh documents function exposed via context
  const refreshDocuments = useCallback(async () => {
    if (state.selectedTransaction?.id) {
      await loadDocuments(state.selectedTransaction.id);
    }
  }, [loadDocuments, state.selectedTransaction?.id]);

  // Visibility-aware document polling
  // Polls every 30 seconds when tab is visible, pauses when hidden
  useEffect(() => {
    const txId = state.selectedTransaction?.id;
    selectedTransactionIdRef.current = txId ?? null;
    // Another deal's documents and status lines must not carry over to this
    // one. Its reader no longer clears the loading flag either.
    dispatch({ type: 'SET_DOCUMENTS', payload: [] });
    dispatch({ type: 'SET_HIDDEN_DOCUMENT_STATUS', payload: [] });
    dispatch({ type: 'SET_DOCUMENTS_LOADING', payload: false });
    if (!txId) return;

    // stopPolling clears the interval, preventing stale closure issues
    // because the interval callback captures txId at creation time.
    // When we call stopPolling before startPolling, we ensure the old
    // interval (with old txId) is cleared before creating a new one.
    const startPolling = () => {
      loadDocuments(txId); // Initial fetch
      pollIntervalRef.current = setInterval(() => loadDocuments(txId), DOCUMENT_POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // stopPolling first prevents stale closure - ensures old interval cleared
        stopPolling();
        loadDocuments(txId); // Immediate refresh on tab becoming visible
        startPolling();
      }
    };

    // Start polling if page is visible
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.selectedTransaction?.id, loadDocuments]);

  // Memoized context value
  const value: SplitPanelContextType = useMemo(
    () => ({
      selectedTransaction: state.selectedTransaction,
      activeContext: state.activeContext,
      userRole,
      transactions: state.transactions,
      transactionsLoading: state.transactionsLoading,
      transactionsError: state.transactionsError,
      transactionDocuments: state.transactionDocuments,
      hiddenDocumentStatus: state.hiddenDocumentStatus,
      documentsLoading: state.documentsLoading,
      documentsError: state.documentsError,
      documentsLastUpdated: state.documentsLastUpdated,
      setSelectedTransaction,
      setActiveContext,
      clearContext,
      refreshTransactions,
      refreshDocuments,
    }),
    [
      state.selectedTransaction,
      state.activeContext,
      userRole,
      state.transactions,
      state.transactionsLoading,
      state.transactionsError,
      state.transactionDocuments,
      state.hiddenDocumentStatus,
      state.documentsLoading,
      state.documentsError,
      state.documentsLastUpdated,
      setSelectedTransaction,
      setActiveContext,
      clearContext,
      refreshTransactions,
      refreshDocuments,
    ]
  );

  return (
    <SplitPanelContext.Provider value={value}>
      {children}
    </SplitPanelContext.Provider>
  );
};

/**
 * Hook to consume split panel context
 *
 * @throws Error if used outside of SplitPanelProvider
 *
 * @example
 * ```tsx
 * const { selectedTransaction, setSelectedTransaction, userRole } = useSplitPanel();
 * ```
 */
export const useSplitPanel = (): SplitPanelContextType => {
  const context = useContext(SplitPanelContext);
  if (context === undefined) {
    throw new Error('useSplitPanel must be used within a SplitPanelProvider');
  }
  return context;
};

export default SplitPanelContext;
