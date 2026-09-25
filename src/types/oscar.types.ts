export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system_';
  content: string;
  timestamp: bigint;
  transactionContext?: string;
  tokensUsed?: number;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: bigint;
  lastActivity: bigint;
  metadata: ConversationMetadata;
}

export interface ConversationMetadata {
  totalTokens: number;
  messageCount: number;
  model: string;
  lastTransactionContext?: string;
}

export interface DocumentSummary {
  total: number;
  uploaded: number;
  verified: number;
  pending: number;
}

export interface MilestonesSummary {
  total: number;
  completed: number;
  inProgress: number;
  nextMilestone?: string;
}

export interface TransactionSummaryInput {
  id: string;
  propertyAddress: string;
  status: string;
  phase: number | bigint;
  role: string;
  daysActive: number | bigint;
  alertLevel: string;
  // Enrichment fields (optional, backward compatible)
  amount?: number;
  postcode?: string;
  propertyType?: string;
  transactionType?: string;
  mode?: string;
  titleNumber?: string;
  inviteCode?: string;
  completionDate?: string;
  createdAt?: string;
  deposit?: number;
  mortgageAmount?: number;
  documentSummary?: DocumentSummary;
  milestonesSummary?: MilestonesSummary;
  partiesCount?: number;
  hasSolicitor?: boolean;
}

export interface ChatRequest {
  message: string;
  transactionContext: [] | [string];
  includeHistory: boolean;
  userTransactions: TransactionSummaryInput[];
}

export interface ChatResponse {
  message: string;
  actions: ActionResult[];
  suggestedFollowups: string[];
  tokensUsed: number;
}

export interface ActionResult {
  action: OscarAction;
  success: boolean;
  result: string;
  timestamp: bigint;
}

export type OscarAction =
  | { queryTransactions: { filter?: string } }
  | { queryDocuments: { transactionId: string } }
  | { sendChaseEmail: { transactionId: string; recipient: string; subject: string } }
  | { orderSearch: { transactionId: string; searchType: string } }
  | { uploadDocument: { transactionId: string; docType: string; hash: string } }
  | { generateDocument: { transactionId: string; templateType: string } }
  | { explainDocument: { documentHash: string } }
  | { updateTransactionStatus: { transactionId: string; status: string } }
  | { addNote: { transactionId: string; note: string } }
  | { scheduleReminder: { transactionId: string; reminderDate: bigint; message: string } };

// ============================================================================
// Oscar Document Analysis Types
// ============================================================================

/**
 * Supported document types for Oscar AI analysis
 */
export type OscarDocumentType =
  | 'passport'
  | 'driving_licence'
  | 'title_deed'
  | 'ta6_form'
  | 'ta7_form'
  | 'ta10_form'
  | 'epc_certificate'
  | 'mortgage_offer'
  | 'proof_of_funds'
  | 'bank_statement'
  | 'lr_official_copy';

/**
 * Issue detected during Oscar document analysis
 */
export interface OscarIssue {
  /** Severity level of the issue */
  severity: 'error' | 'warning' | 'info';
  /** Unique code identifying the issue type */
  code: string;
  /** Human-readable description of the issue */
  message: string;
  /** Optional field/section where the issue was found */
  field?: string;
}

/**
 * Data mismatch between document and expected values
 */
export interface DataMismatch {
  /** Name of the mismatched field */
  field: string;
  /** Expected value from transaction context */
  expected: string;
  /** Actual value found in document */
  found: string;
}

/**
 * Result of Oscar AI document analysis
 */
export interface OscarAnalysisResult {
  /** Whether the document passed verification */
  verified: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** List of issues found during analysis */
  issues: OscarIssue[];
  /** Data extracted from the document */
  extractedData: Record<string, unknown>;
  /** Mismatches between document and expected transaction data */
  mismatches: DataMismatch[];
  /** Recommendations for resolving issues */
  recommendations: string[];
  /** Whether manual solicitor review is required */
  requiresSolicitorReview: boolean;
  /** ISO timestamp of when analysis was performed */
  analysisTimestamp: string;
}

/**
 * Transaction context for document verification
 */
export interface TransactionContext {
  /** Property address from transaction */
  propertyAddress?: string;
  /** Land Registry title number */
  titleNumber?: string;
  /** Buyer's full name */
  buyerName?: string;
  /** Seller's full name */
  sellerName?: string;
  /** Agreed sale price */
  salePrice?: number;
  /** Expected completion date (ISO string) */
  expectedCompletionDate?: string;
}

/**
 * Request payload for document analysis API
 */
export interface DocumentAnalysisRequest {
  /** User's ICP principal ID */
  principalId: string;
  /** Type of document being analyzed */
  documentType: OscarDocumentType;
  /** Base64-encoded file content */
  fileBase64: string;
  /** MIME type of the file */
  mimeType: string;
  /** Optional transaction context for cross-validation */
  transactionContext?: TransactionContext;
}

/**
 * On-chain Oscar verification input format
 */
export interface OscarVerificationInput {
  /** Confidence score (0-100) */
  confidence: number;
  /** Issues in canister variant format */
  issues: Array<{
    severity: Record<string, null>;
    code: string;
    message: string;
    field: string[];
  }>;
  /** JSON-stringified extracted data */
  extractedData: string;
  /** Data mismatches */
  mismatches: Array<{
    field: string;
    expected: string;
    found: string;
  }>;
  /** Whether solicitor review is required */
  requiresSolicitorReview: boolean;
  /** Document type */
  documentType: string;
}
