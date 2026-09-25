import { useState, useCallback, useRef, useReducer } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { icpService } from '../services/icp.service';
import { supabaseAuthService } from '../services/supabase.auth.service';
import { messageService } from '../services/message.service';
import { logger } from '@/utils/logger';
import { queryKeys, queryClient, invalidateAdminQueries } from '@/lib/queryClient';
import type {
  DashboardTab,
  SummaryData,
  CanisterCycleInfo,
  AlertItem,
  EmailNotification,
  DashboardUser,
  BudgetData,
  StorageStats,
  VerificationStats,
  UseAdminDashboardReturn,
  LRCredentialStatus,
  LRApiHealth,
  LRRateLimit,
  LRPendingApplication,
  LRRequisition,
  LRExpiringSearch,
  ExpiredLRDocument,
  AuditLogEntry,
  TransactionCost,
  DashboardProperty,
  MessageStats,
  DashboardThread,
} from '../types/adminDashboard.types';
import type { Transaction } from '../types/transaction.types';
import { isCompletedStatus } from '../types/transactionStatus';

const CYCLE_THRESHOLD_GREEN = BigInt(2_000_000_000_000);
const CYCLE_THRESHOLD_AMBER = BigInt(1_000_000_000_000);

function getCycleHealth(cycles: bigint): 'green' | 'amber' | 'red' {
  if (cycles > CYCLE_THRESHOLD_GREEN) return 'green';
  if (cycles > CYCLE_THRESHOLD_AMBER) return 'amber';
  return 'red';
}

// Per-call ceiling for the summary fetch. A `.catch` cannot rescue a call that
// never settles (e.g. an IC call against an expired/invalid session, or an
// unreachable canister) — without this the summary query stays pending forever
// and the header cards are stuck on skeletons. The timeout resolves to a
// fallback and logs which call stalled so the root cause is diagnosable.
const SUMMARY_CALL_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, fallback: T, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        logger.error(`summary: ${label} timed out after ${SUMMARY_CALL_TIMEOUT_MS}ms`);
        resolve(fallback);
      }, SUMMARY_CALL_TIMEOUT_MS);
    }),
  ]);
}

// Aggregate shapes returned by the multi-value query functions. Keeping these
// local keeps the public return type (UseAdminDashboardReturn) untouched while
// letting each useQuery hold a single typed value.
interface LandRegistryData {
  apiHealth: LRApiHealth | null;
  credentialStatus: LRCredentialStatus | null;
  rateLimits: LRRateLimit[];
  pendingApplications: LRPendingApplication[];
  expiringSearches: LRExpiringSearch[];
  requisitions: LRRequisition[];
}

interface EmailsData {
  notifications: EmailNotification[];
  count: number;
}

interface DocumentsData {
  storageStats: StorageStats | null;
  verificationStats: VerificationStats | null;
  expired: ExpiredLRDocument[];
  auditLogs: AuditLogEntry[];
}

interface MessagesData {
  stats: MessageStats | null;
  threads: DashboardThread[];
  unread: number;
}

// ==================== Query Functions ====================
// Each queryFn is the body of the previous fetch* function, minus the
// setState/loading/error plumbing (React Query owns those now). Mapping logic
// is relocated verbatim so the data shapes stay byte-for-byte identical.

async function fetchTransactionsData(): Promise<Transaction[]> {
  return icpService.getAllTransactions();
}

async function fetchUsersData(): Promise<DashboardUser[]> {
  const [blockchainUsers, emailRegs] = await Promise.all([
    icpService.getAllUsers(),
    supabaseAuthService.getEmailRegistrations().catch(() => []),
  ]);

  const emailPrincipals = new Set(
    emailRegs.filter(r => r.icp_principal).map(r => r.icp_principal)
  );

  const dashboardUsers: DashboardUser[] = blockchainUsers.map((u: Record<string, unknown>) => ({
    id: String(u.id || u.principal || ''),
    email: String(u.email || ''),
    name: String(u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim()),
    principal: String(u.principal || u.id || ''),
    role: String(u.role || ''),
    userType: String(u.userType || ''),
    isVerified: Boolean(u.isVerified),
    createdAt: u.createdAt ? new Date(Number(u.createdAt) / 1_000_000).toISOString() : '',
    authMethod: emailPrincipals.has(String(u.principal || u.id)) ? 'Email' : 'II',
  }));

  // Add pending email registrations not yet on canister
  const canisterPrincipals = new Set(dashboardUsers.map(u => u.principal));
  emailRegs.forEach(reg => {
    if (!reg.icp_principal || !canisterPrincipals.has(reg.icp_principal)) {
      dashboardUsers.push({
        id: reg.id,
        email: reg.email,
        name: reg.name || '',
        principal: reg.icp_principal || 'Pending',
        role: '',
        userType: '',
        isVerified: false,
        createdAt: reg.created_at,
        authMethod: reg.icp_principal ? 'Email' : 'Pending',
      });
    }
  });

  return dashboardUsers;
}

// Enriched canister fetch (Canisters tab): pulls management-canister status for
// memory/freezing/controllers. Heavier than the light summary fetch — only run
// when the Canisters tab is visited.
async function fetchCanistersData(): Promise<CanisterCycleInfo[]> {
  const cyclesData = await icpService.getAllCanisterCycles();
  const entries = Object.entries(cyclesData);

  // Enrich with management canister status (freezing threshold, controllers, memory).
  // Asset canisters don't expose getCycles(), so for those we also pull cycles
  // from the management canister's canister_status response.
  const enriched = await Promise.all(
    entries.map(async ([name, data]) => {
      let cycles = data.cycles;
      let cycleError = data.error;
      let mgmtStatus: Awaited<ReturnType<typeof icpService.getCanisterFullStatus>> = null;

      if (data.canisterId) {
        try {
          mgmtStatus = await icpService.getCanisterFullStatus(data.canisterId);
          if (cycleError && mgmtStatus) {
            cycles = mgmtStatus.cycles;
            cycleError = undefined;
          }
        } catch {
          // Non-fatal — management canister call may fail if not a controller
        }
      }

      const base: CanisterCycleInfo = {
        name,
        canisterId: data.canisterId,
        cycles,
        health: cycleError ? 'unknown' as const : getCycleHealth(cycles),
        error: cycleError,
      };

      if (mgmtStatus) {
        base.freezingThreshold = mgmtStatus.freezingThreshold;
        base.controllers = mgmtStatus.controllers;
        base.memorySize = mgmtStatus.memorySize;
        base.status = mgmtStatus.status;
      }

      return base;
    })
  );

  return enriched;
}

// Summary fetch (initial mount): uses the LIGHT canister fetch
// (getAllCanisterCycles only — no per-canister management enrichment) so the
// summary cards render fast. Canister cycles are NOT enriched here; the
// enriched fetch lives in fetchCanistersData and only runs on the Canisters tab.
async function fetchSummaryData(): Promise<SummaryData> {
  // Each source is independently guarded so one failure can't blank the whole
  // summary card row (mirrors fetchLandRegistryData). The logs name the failing
  // call so a recurring backend/canister issue is diagnosable from the console.
  const emptyCycles = {} as Awaited<ReturnType<typeof icpService.getAllCanisterCycles>>;
  // Transaction count is NOT fetched here. icpService serialises calls through a
  // rate-limit queue, so a getAllTransactions issued alongside the 12-canister
  // getAllCanisterCycles queues behind them and blows the timeout — yielding a
  // wrong "0 active". activeTransactions is derived from the dedicated
  // transactions query instead (see the hook return), which fetches it once.
  const [cyclesData, budgetStatus] = await Promise.all([
    withTimeout(
      icpService.getAllCanisterCycles().catch((e) => {
        logger.error('summary: getAllCanisterCycles failed', e);
        return emptyCycles;
      }),
      emptyCycles,
      'getAllCanisterCycles',
    ),
    withTimeout(icpService.getBudgetStatus().catch(() => null), null, 'getBudgetStatus'),
  ]);

  const canisterData = Object.entries(cyclesData).map(([name, data]) => ({
    name,
    canisterId: data.canisterId,
    cycles: data.cycles,
    health: data.error ? ('unknown' as const) : getCycleHealth(data.cycles),
    error: data.error,
  }));

  const healthyCanisters = canisterData.filter(c => c.health === 'green').length;

  const alerts: AlertItem[] = [];
  canisterData.forEach(c => {
    if (c.health === 'red') {
      alerts.push({ type: 'low-cycles', message: `${c.name} cycles critically low`, severity: 'critical' });
    } else if (c.health === 'amber') {
      alerts.push({ type: 'low-cycles', message: `${c.name} cycles low`, severity: 'warning' });
    }
  });

  return {
    healthyCanisters,
    totalCanisters: canisterData.length,
    // Placeholder — overridden in the hook from the transactions query, which
    // owns the real count (see comment above on the rate-limit queue).
    activeTransactions: 0,
    lrBudgetRemaining: budgetStatus?.remaining ?? null,
    lrBudgetTotal: budgetStatus?.total ?? null,
    alertCount: alerts.length,
    alerts,
  };
}

async function fetchLandRegistryData(): Promise<LandRegistryData> {
  const [status, credStatus, rateLimits, pending, allLrTxns, requisitions] = await Promise.all([
    icpService.getLandRegistryStatus().catch(() => null),
    icpService.getCredentialStatus().catch(() => null),
    icpService.getRateLimitStatus().catch(() => []),
    icpService.getPendingLRSubmissions('propxchain').catch(() => []),
    icpService.getAllLandRegistryTransactions().catch(() => []),
    icpService.getOutstandingRequisitions().catch(() => []),
    // expiringSearches are derived from allLrTxns below, not fetched directly.
    icpService.getExpiringSearches(30).catch(() => []),
  ]);

  const apiHealth: LRApiHealth = status
    ? {
        endpoint: status.apiEndpoint,
        environment: 'production' in status.environment ? 'production' : 'sandbox',
        lastValidated: status.lastValidated ? new Date(Number(status.lastValidated) / 1_000_000).toISOString() : null,
        isConfigured: true,
      }
    : { endpoint: '', environment: 'unknown', lastValidated: null, isConfigured: false };

  // Credential status (canister method may not exist yet — graceful null)
  const credentialStatus: LRCredentialStatus | null = credStatus
    ? {
        status: (['active', 'expired', 'invalid'].includes(String(credStatus.status)) ? String(credStatus.status) : 'unknown') as 'active' | 'expired' | 'invalid' | 'unknown',
        lastChecked: credStatus.lastChecked ? new Date(Number(credStatus.lastChecked) / 1_000_000).toISOString() : null,
      }
    : null;

  const mappedRateLimits: LRRateLimit[] = rateLimits.map(rl => ({
    endpoint: rl.endpoint,
    callsToday: rl.callsToday,
    callsThisHour: rl.callsThisHour,
    resetTime: rl.resetTime ? new Date(Number(rl.resetTime) / 1_000_000).toISOString() : '',
  }));

  const pendingApplications: LRPendingApplication[] = (pending as Array<Record<string, unknown>>).map(p => ({
    transactionId: String(p.transactionID || ''),
    titleNumber: String((p.landRegistryPayload as Record<string, unknown>)?.titleNumber || ''),
    status: Object.keys(p.status as Record<string, unknown>)[0] || 'unknown',
    submittedDate: p.createdAt ? new Date(Number(p.createdAt) / 1_000_000).toISOString() : '',
  }));

  // Expiring searches derived from LR transaction data
  const expiringSearches: LRExpiringSearch[] = [];
  (allLrTxns as Array<[string, Record<string, unknown>]>).forEach(([, record]) => {
    const apiResp = (record.apiResponse as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (apiResp?.estimatedCompletionTime) {
      const expiryMs = Number(apiResp.estimatedCompletionTime) / 1_000_000;
      const daysRemaining = Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 30 && daysRemaining > 0) {
        expiringSearches.push({
          transactionId: String(record.transactionID),
          searchType: 'Land Registry Search',
          expiryDate: new Date(expiryMs).toISOString(),
          daysRemaining,
        });
      }
    }
  });

  // Map requisitions from canister data
  const mappedReqs: LRRequisition[] = (requisitions as Array<[string, Record<string, unknown>]>).map(([txId, req]) => ({
    transactionId: txId,
    field: String(req.category || ''),
    severity: 'medium' as const,
    description: String(req.description || ''),
    deadline: req.raisedAt ? new Date(Number(req.raisedAt) / 1_000_000 + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
  }));

  return {
    apiHealth,
    credentialStatus,
    rateLimits: mappedRateLimits,
    pendingApplications,
    expiringSearches,
    requisitions: mappedReqs,
  };
}

async function fetchBudgetData(): Promise<BudgetData> {
  const [daily, monthly, budgetStatus] = await Promise.all([
    icpService.getDailyLRSpend().catch(() => null),
    icpService.getMonthlyLRSpend().catch(() => null),
    icpService.getBudgetStatus().catch(() => null),
  ]);

  return {
    dailySpend: daily,
    monthlySpend: monthly,
    budgetRemaining: budgetStatus?.remaining ?? null,
    budgetTotal: budgetStatus?.total ?? null,
    canAfford: budgetStatus?.canAfford ?? true,
  };
}

async function fetchEmailsData(): Promise<EmailsData> {
  const [notifications, count] = await Promise.all([
    icpService.getEmailNotifications(),
    icpService.getUnprocessedEmailCount(),
  ]);

  const mapped: EmailNotification[] = notifications.map((n: Record<string, unknown>) => ({
    id: Number(n.id),
    type: String(n.notificationType || n.type || ''),
    fromName: String(n.senderName || n.fromName || ''),
    fromEmail: String(n.senderEmail || n.fromEmail || ''),
    subject: String(n.subject || ''),
    date: String(n.createdAt || n.date || ''),
    status: String(n.status || ''),
    isProcessed: Boolean(n.isProcessed),
  }));

  return { notifications: mapped, count };
}

async function fetchDocumentsData(): Promise<DocumentsData> {
  const [storage, verification, expired, logs] = await Promise.all([
    icpService.getStorageStats().catch(() => null),
    icpService.getVerificationStats().catch(() => null),
    icpService.getExpiredLRDocuments().catch(() => []),
    icpService.getRecentStorageAuditLogs(20).catch(() => []),
  ]);

  const storageStats: StorageStats | null = storage
    ? {
        totalDocuments: Number(storage.totalDocuments ?? 0),
        totalStorageBytes: Number(storage.totalStorageBytes ?? storage.totalSize ?? 0),
      }
    : null;

  const expiredMapped: ExpiredLRDocument[] = (expired as Array<Record<string, unknown>>).map(d => ({
    documentId: String(d.id || d.documentId || ''),
    titleNumber: String(d.titleNumber || ''),
    type: String(d.documentType || d.type || ''),
    expiryDate: String(d.expiryDate || ''),
  }));

  const auditLogs: AuditLogEntry[] = (logs as Array<Record<string, unknown>>).map(l => ({
    timestamp: String(l.timestamp || ''),
    actor: String(l.actor || l.principal || ''),
    action: String(l.action || ''),
    documentId: String(l.documentId || l.id || ''),
  }));

  return { storageStats, verificationStats: verification, expired: expiredMapped, auditLogs };
}

async function fetchPropertiesData(): Promise<DashboardProperty[]> {
  return icpService.getAllProperties();
}

async function fetchMessagesData(): Promise<MessagesData> {
  const [stats, rawThreads, unread] = await Promise.all([
    messageService.getStats().catch(() => null),
    messageService.getMyThreads().catch(() => []),
    messageService.getUnreadCount().catch(() => 0),
  ]);

  const messageStats: MessageStats | null = stats
    ? { threadCount: stats.threadCount, messageCount: stats.messageCount }
    : null;

  const threads: DashboardThread[] = rawThreads.map((t) => ({
    id: t.thread.id,
    transactionId: t.thread.transactionId,
    subject: t.thread.subject,
    participantCount: t.thread.participants.length,
    messageCount: t.thread.messageCount,
    lastMessageAt: t.thread.lastMessageAt.getTime(),
    unreadCount: t.unreadCount,
  }));

  return { stats: messageStats, threads, unread };
}

export function useAdminDashboard(opts: { ready?: boolean } = {}): UseAdminDashboardReturn {
  // `ready` gates all fetching until the admin is authenticated. The summary
  // query in particular must NOT fire on mount (before auth): getAllCanisterCycles
  // needs the authenticated agent and rejects pre-auth, which previously blanked
  // the summary cards. Defaults true so non-gated callers are unaffected.
  const ready = opts.ready ?? true;
  // Tab state. Tabs are lazily loaded: a domain query is only enabled once its
  // tab has been visited (transactions + summary load on mount). The `force`
  // reducer re-renders so newly-enabled queries pick up the change.
  const [activeTab, setActiveTab] = useState<DashboardTab>('transactions');
  const visitedTabs = useRef<Set<DashboardTab>>(new Set<DashboardTab>(['transactions']));
  const [, force] = useReducer((n: number) => n + 1, 0);

  const handleTabChange = useCallback((tab: DashboardTab): void => {
    setActiveTab(tab);
    if (!visitedTabs.current.has(tab)) {
      visitedTabs.current.add(tab);
      force();
    }
  }, []);

  // ==================== Queries ====================

  // Summary loads on mount (light canister fetch — no enrichment).
  const summaryQuery = useQuery({
    queryKey: queryKeys.admin.summary(),
    queryFn: fetchSummaryData,
    enabled: ready,
  });

  // Transactions load on mount (default tab).
  const transactionsQuery = useQuery({
    queryKey: queryKeys.admin.transactions(),
    queryFn: fetchTransactionsData,
    enabled: ready && visitedTabs.current.has('transactions'),
  });

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: fetchUsersData,
    enabled: ready && visitedTabs.current.has('users'),
  });

  // Enriched canister fetch — only once the Canisters tab is visited. This is a
  // separate query from the summary, so canister cycles are no longer fetched
  // multiple times for one dashboard view.
  const canistersQuery = useQuery({
    queryKey: queryKeys.admin.canisters(),
    queryFn: fetchCanistersData,
    enabled: ready && visitedTabs.current.has('canisters'),
  });

  const landRegistryQuery = useQuery({
    queryKey: queryKeys.admin.landRegistry(),
    queryFn: fetchLandRegistryData,
    enabled: ready && visitedTabs.current.has('land-registry'),
  });

  const budgetQuery = useQuery({
    queryKey: queryKeys.admin.budget(),
    queryFn: fetchBudgetData,
    enabled: ready && visitedTabs.current.has('budget'),
  });

  const emailsQuery = useQuery({
    queryKey: queryKeys.admin.emails(),
    queryFn: fetchEmailsData,
    enabled: ready && visitedTabs.current.has('emails'),
  });

  const documentsQuery = useQuery({
    queryKey: queryKeys.admin.documents(),
    queryFn: fetchDocumentsData,
    enabled: ready && visitedTabs.current.has('documents'),
  });

  const propertiesQuery = useQuery({
    queryKey: queryKeys.admin.properties(),
    queryFn: fetchPropertiesData,
    enabled: ready && visitedTabs.current.has('properties'),
  });

  const messagesQuery = useQuery({
    queryKey: queryKeys.admin.messages(),
    queryFn: fetchMessagesData,
    enabled: ready && visitedTabs.current.has('messages'),
  });
  // Note: 'admin-users' and 'conveyancers' tabs self-fetch via their own React
  // Query inside their components — no hook-level query for them.

  // ==================== Mutations ====================

  // Top-up is intentionally not exposed: browsers can't attach cycles to a call.
  // The CanisterHealthPanel surfaces a copy-pasteable dfx command instead.

  const freezingMutation = useMutation({
    mutationFn: (vars: { canisterId: string; thresholdSeconds: number }) =>
      icpService.updateCanisterSettings(vars.canisterId, { freezingThreshold: vars.thresholdSeconds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.canisters() });
    },
  });

  const setFreezingThreshold = useCallback(
    async (canisterId: string, thresholdSeconds: number): Promise<void> => {
      await freezingMutation.mutateAsync({ canisterId, thresholdSeconds });
    },
    [freezingMutation]
  );

  const markEmailMutation = useMutation({
    mutationFn: (id: number) => icpService.markEmailAsProcessed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.emails() });
    },
  });

  const markEmailProcessed = useCallback(
    async (id: number): Promise<void> => {
      await markEmailMutation.mutateAsync(id);
    },
    [markEmailMutation]
  );

  const markAllEmailsMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const unprocessed = (emailsQuery.data?.notifications ?? []).filter(n => !n.isProcessed);
      await Promise.all(unprocessed.map(n => icpService.markEmailAsProcessed(n.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.emails() });
    },
  });

  const markAllEmailsProcessed = useCallback(async (): Promise<void> => {
    await markAllEmailsMutation.mutateAsync();
  }, [markAllEmailsMutation]);

  // ==================== Refresh + Meta ====================

  const refresh = useCallback(async (): Promise<void> => {
    await invalidateAdminQueries();
  }, []);

  // lastUpdated tracks the summary query's last successful fetch — the summary
  // always loads on mount, so this is the dashboard's overall freshness clock.
  const lastUpdated = summaryQuery.dataUpdatedAt ? new Date(summaryQuery.dataUpdatedAt) : null;

  // Rebuild the error map from each query's error, preserving the original
  // user-facing message strings.
  const errors: Record<string, string> = {};
  if (summaryQuery.error) errors.summary = 'Failed to load summary data';
  if (transactionsQuery.error) errors.transactions = 'Failed to load transactions';
  if (usersQuery.error) errors.users = 'Failed to load users';
  if (canistersQuery.error) errors.canisters = 'Failed to load canister data';
  if (landRegistryQuery.error) errors['land-registry'] = 'Failed to load Land Registry data';
  if (budgetQuery.error) errors.budget = 'Failed to load budget data';
  if (emailsQuery.error) errors.emails = 'Failed to load email notifications';
  if (documentsQuery.error) errors.documents = 'Failed to load document data';
  if (propertiesQuery.error) errors.properties = 'Failed to load properties';
  if (messagesQuery.error) errors.messages = 'Failed to load messages';

  // transactionCosts: future feature — requires N+1 canister calls (one per
  // transaction). Will be implemented when getLRCostsForTransaction is needed
  // for daily ops.
  const transactionCosts: TransactionCost[] = [];

  const networkLabel = import.meta.env.VITE_DFX_NETWORK === 'local' ? 'Local' : 'IC Mainnet';

  const landRegistry = landRegistryQuery.data;

  // Derive the active-transaction count from the transactions query (which
  // fetches the list once, on its own) rather than re-fetching inside the
  // summary, where it would queue behind the canister calls. Overrides the
  // placeholder set in fetchSummaryData.
  const summary = summaryQuery.data
    ? {
        ...summaryQuery.data,
        activeTransactions: (transactionsQuery.data ?? []).filter((tx) => !isCompletedStatus(tx.status)).length,
      }
    : null;

  return {
    summary,
    isSummaryLoading: summaryQuery.isLoading,
    activeTab,
    setActiveTab: handleTabChange,
    transactions: transactionsQuery.data ?? [],
    isTransactionsLoading: transactionsQuery.isLoading,
    users: usersQuery.data ?? [],
    isUsersLoading: usersQuery.isLoading,
    canisters: canistersQuery.data ?? [],
    isCanistersLoading: canistersQuery.isLoading,
    lrCredentialStatus: landRegistry?.credentialStatus ?? null,
    lrApiHealth: landRegistry?.apiHealth ?? null,
    lrRateLimits: landRegistry?.rateLimits ?? [],
    lrPendingApplications: landRegistry?.pendingApplications ?? [],
    lrRequisitions: landRegistry?.requisitions ?? [],
    lrExpiringSearches: landRegistry?.expiringSearches ?? [],
    isLandRegistryLoading: landRegistryQuery.isLoading,
    budget: budgetQuery.data ?? null,
    transactionCosts,
    isBudgetLoading: budgetQuery.isLoading,
    emailNotifications: emailsQuery.data?.notifications ?? [],
    unprocessedEmailCount: emailsQuery.data?.count ?? 0,
    isEmailsLoading: emailsQuery.isLoading,
    markEmailProcessed,
    markAllEmailsProcessed,
    setFreezingThreshold,
    storageStats: documentsQuery.data?.storageStats ?? null,
    verificationStats: documentsQuery.data?.verificationStats ?? null,
    expiredLRDocuments: documentsQuery.data?.expired ?? [],
    auditLogs: documentsQuery.data?.auditLogs ?? [],
    isDocumentsLoading: documentsQuery.isLoading,
    properties: propertiesQuery.data ?? [],
    isPropertiesLoading: propertiesQuery.isLoading,
    messageStats: messagesQuery.data?.stats ?? null,
    messageThreads: messagesQuery.data?.threads ?? [],
    messageUnreadCount: messagesQuery.data?.unread ?? 0,
    isMessagesLoading: messagesQuery.isLoading,
    refresh,
    lastUpdated,
    networkLabel,
    errors,
  };
}
