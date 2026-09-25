import { Transaction } from './transaction.types';

// ==================== Canister Types ====================

export interface CanisterCycleInfo {
  name: string;
  canisterId: string;
  cycles: bigint;
  health: 'green' | 'amber' | 'red' | 'unknown';
  error?: string;
  freezingThreshold?: number;
  controllers?: string[];
  memorySize?: bigint;
  status?: string;
}

export type CanisterHealthMap = Record<string, CanisterCycleInfo>;

// ==================== Summary Card Types ====================

export interface SummaryData {
  healthyCanisters: number;
  totalCanisters: number;
  activeTransactions: number;
  lrBudgetRemaining: number | null;
  lrBudgetTotal: number | null;
  alertCount: number;
  alerts: AlertItem[];
}

export interface AlertItem {
  type: 'low-cycles' | 'expiring-search' | 'requisition';
  message: string;
  severity: 'warning' | 'critical';
}

// ==================== Land Registry Types ====================

export interface LRCredentialStatus {
  status: 'active' | 'expired' | 'invalid' | 'unknown';
  lastChecked: string | null;
}

export interface LRApiHealth {
  endpoint: string;
  environment: string;
  lastValidated: string | null;
  isConfigured: boolean;
}

export interface LRRateLimit {
  endpoint: string;
  // Calls made, not remaining — the per-endpoint caps are private to the
  // land_registry_integration canister and are deliberately not mirrored here.
  callsToday: number;
  callsThisHour: number;
  resetTime: string;
}

export interface LRPendingApplication {
  transactionId: string;
  titleNumber: string;
  status: string;
  submittedDate: string;
}

export interface LRRequisition {
  transactionId: string;
  field: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  deadline: string | null;
}

export interface LRExpiringSearch {
  transactionId: string;
  searchType: string;
  expiryDate: string;
  daysRemaining: number;
}

// ==================== Budget Types ====================

export interface BudgetData {
  dailySpend: number | null;
  monthlySpend: number | null;
  budgetRemaining: number | null;
  budgetTotal: number | null;
  canAfford: boolean;
}

export interface TransactionCost {
  transactionId: string;
  costs: Record<string, number>;
  total: number;
}

// ==================== Email Types ====================

export interface EmailNotification {
  id: number;
  type: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  date: string;
  status: string;
  isProcessed: boolean;
}

export type EmailFilterType = 'all' | 'support' | 'sales' | 'partners' | 'lr' | 'unprocessed';

// ==================== User Types ====================

export interface DashboardUser {
  id: string;
  email: string;
  name: string;
  principal: string;
  role: string;
  userType: string;
  isVerified: boolean;
  createdAt: string;
  authMethod: 'II' | 'Email' | 'Pending';
}

// ==================== Document Types ====================

export interface StorageStats {
  totalDocuments: number;
  totalStorageBytes: number;
}

export interface VerificationStats {
  verified: number;
  pending: number;
  failed: number;
}

export interface ExpiredLRDocument {
  documentId: string;
  titleNumber: string;
  type: string;
  expiryDate: string;
}

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  action: string;
  documentId: string;
}

// ==================== Property Types ====================

export type PropertyStatusString = 'Listed' | 'InTransaction' | 'Completed' | 'Cancelled';

export interface DashboardProperty {
  id: number;
  address: string;
  owner: string;
  price: number;
  size: number;
  propertyType: string;
  description: string;
  status: PropertyStatusString;
  // Who attested the record's details are correct, and when (ADR 0018).
  // Replaces isVerified; unset means nobody has vouched for it yet.
  attestedBy?: string;
  attestedAt?: number;
  createdAt: number;
  transactionId?: string;
  documentsComplete: boolean;
  searchesComplete: boolean;
  financingComplete: boolean;
}

// ==================== Message Types ====================

export interface MessageStats {
  threadCount: number;
  messageCount: number;
}

export interface DashboardThread {
  id: string;
  transactionId: string;
  subject: string;
  participantCount: number;
  messageCount: number;
  lastMessageAt: number;
  unreadCount: number;
}

// ==================== Tab Types ====================

export type DashboardTab = 'transactions' | 'users' | 'canisters' | 'land-registry' | 'budget' | 'emails' | 'documents' | 'properties' | 'messages' | 'conveyancers';

// Top-level groupings for the 2-level admin tab bar. The active group is
// derived from whichever group contains the current DashboardTab.
export type AdminTabGroup = 'operations' | 'people' | 'platform';

export const ADMIN_TAB_GROUPS: Record<AdminTabGroup, { label: string; tabs: DashboardTab[] }> = {
  operations: { label: 'Operations', tabs: ['transactions', 'properties', 'documents', 'land-registry', 'budget', 'conveyancers'] },
  people:     { label: 'People & Comms', tabs: ['users', 'messages', 'emails'] },
  platform:   { label: 'Platform', tabs: ['canisters'] },
};

// ==================== Hook Return Type ====================

export interface UseAdminDashboardReturn {
  // Summary
  summary: SummaryData | null;
  isSummaryLoading: boolean;

  // Active tab
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;

  // Transactions (reuse existing pattern)
  transactions: Transaction[];
  isTransactionsLoading: boolean;

  // Users
  users: DashboardUser[];
  isUsersLoading: boolean;

  // Canisters
  canisters: CanisterCycleInfo[];
  isCanistersLoading: boolean;

  // Land Registry
  lrCredentialStatus: LRCredentialStatus | null;
  lrApiHealth: LRApiHealth | null;
  lrRateLimits: LRRateLimit[];
  lrPendingApplications: LRPendingApplication[];
  lrRequisitions: LRRequisition[];
  lrExpiringSearches: LRExpiringSearch[];
  isLandRegistryLoading: boolean;

  // Budget
  budget: BudgetData | null;
  transactionCosts: TransactionCost[];
  isBudgetLoading: boolean;

  // Emails
  emailNotifications: EmailNotification[];
  unprocessedEmailCount: number;
  isEmailsLoading: boolean;
  markEmailProcessed: (id: number) => Promise<void>;
  markAllEmailsProcessed: () => Promise<void>;

  // Documents
  storageStats: StorageStats | null;
  verificationStats: VerificationStats | null;
  expiredLRDocuments: ExpiredLRDocument[];
  auditLogs: AuditLogEntry[];
  isDocumentsLoading: boolean;

  // Properties
  properties: DashboardProperty[];
  isPropertiesLoading: boolean;

  // Messages
  messageStats: MessageStats | null;
  messageThreads: DashboardThread[];
  messageUnreadCount: number;
  isMessagesLoading: boolean;

  // Canister actions — top-up is not browser-callable (cycles can't be
  // attached from a user principal); the panel shows a dfx command instead.
  setFreezingThreshold: (canisterId: string, thresholdSeconds: number) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
  lastUpdated: Date | null;

  // Network
  networkLabel: string;

  // Errors
  errors: Record<string, string>;
}
