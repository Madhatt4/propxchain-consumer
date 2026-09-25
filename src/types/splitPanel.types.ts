// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { Transaction } from './transaction.types';

/**
 * Document proof information from document_storage canister
 * Principal converted to string for display
 */
export interface DocumentProofInfo {
  /** Unique document ID */
  id: bigint;
  /** Whether document has been verified */
  verified: boolean;
  /** MIME content type */
  contentType: string;
  /** SHA-256 hash of file content */
  fileHash: string;
  /** Original filename */
  fileName: string;
  /** File size in bytes */
  fileSize: bigint;
  /** Where the actual file is stored (GDPR-compliant local storage) */
  storageLocation: string;
  /** Document type classification */
  docType: string;
  /** Upload timestamp (nanoseconds) */
  uploadedAt: bigint;
  /** Principal who uploaded, converted to string */
  uploadedBy: string;
  /** Associated transaction ID, if any */
  transactionId: string | null;
}

/**
 * Simplified role categories for Oscar dashboard
 * Maps the 18 UserType variants to 3 primary categories
 */
export type SimplifiedRole = 'buyer' | 'seller' | 'solicitor' | null;

/**
 * Confidence level for auto-detected context
 */
export type ContextConfidence = 'high' | 'medium' | 'low';

/**
 * Type of conversation context Oscar is operating in
 */
export type ContextType = 'transaction' | 'document' | 'message';

/**
 * Conversation context for Oscar AI
 * Tracks what entity Oscar is helping with
 */
export interface ConversationContext {
  /** Type of context (transaction, document, or message) */
  type: ContextType;
  /** ID of the entity (transaction ID, document ID, or message thread ID) */
  id: string;
  /** Human-readable title for display */
  title: string;
  /** Whether this context was auto-detected from conversation */
  autoDetected: boolean;
  /** Confidence level of auto-detection */
  confidence: ContextConfidence;
}

/**
 * Core state for split panel dashboard
 */
export interface SplitPanelState {
  /** Currently selected transaction (displayed in transaction panel) */
  selectedTransaction: Transaction | null;
  /** Active conversation context for Oscar AI */
  activeContext: ConversationContext | null;
  /** User's simplified role (derived from auth store) */
  userRole: SimplifiedRole;
  /** List of user's transactions loaded from blockchain */
  transactions: Transaction[];
  /** Loading state for transactions fetch */
  transactionsLoading: boolean;
  /** Error message if transactions fetch failed */
  transactionsError: string | null;
  /** Documents for selected transaction */
  transactionDocuments: DocumentProofInfo[];
  /** Loading state for documents fetch */
  documentsLoading: boolean;
  /** Error message if documents fetch failed */
  documentsError: string | null;
  /** Timestamp of last successful document refresh */
  documentsLastUpdated: number | null;
}

/**
 * Discriminated union for reducer actions
 */
export type SplitPanelAction =
  | { type: 'SET_TRANSACTION'; payload: Transaction | null }
  | { type: 'SET_CONTEXT'; payload: ConversationContext | null }
  | { type: 'SET_ROLE'; payload: SimplifiedRole }
  | { type: 'CLEAR_CONTEXT' }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_TRANSACTIONS_LOADING'; payload: boolean }
  | { type: 'SET_TRANSACTIONS_ERROR'; payload: string | null }
  | { type: 'REFRESH_TRANSACTIONS' }
  | { type: 'SET_DOCUMENTS'; payload: DocumentProofInfo[] }
  | { type: 'SET_DOCUMENTS_LOADING'; payload: boolean }
  | { type: 'SET_DOCUMENTS_ERROR'; payload: string | null }
  | { type: 'SET_DOCUMENTS_LAST_UPDATED'; payload: number };

/**
 * Full context type combining state with action functions
 */
export interface SplitPanelContextType {
  /** Current state */
  selectedTransaction: Transaction | null;
  activeContext: ConversationContext | null;
  userRole: SimplifiedRole;
  /** User's transactions from blockchain */
  transactions: Transaction[];
  /** Loading state for transactions */
  transactionsLoading: boolean;
  /** Error message if transactions failed to load */
  transactionsError: string | null;
  /** Documents for selected transaction */
  transactionDocuments: DocumentProofInfo[];
  /** Loading state for documents */
  documentsLoading: boolean;
  /** Error message if documents failed to load */
  documentsError: string | null;
  /** Timestamp of last successful document refresh */
  documentsLastUpdated: number | null;

  /** Action functions */
  setSelectedTransaction: (transaction: Transaction | null) => void;
  setActiveContext: (context: ConversationContext | null) => void;
  clearContext: () => void;
  /** Refresh transactions from blockchain */
  refreshTransactions: () => Promise<void>;
  /** Refresh documents for selected transaction */
  refreshDocuments: () => Promise<void>;
}
