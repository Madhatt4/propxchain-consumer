import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { useTheme } from '../contexts/ThemeContext';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { useOpenTicketCount } from '../hooks/useOpenTicketCount';
import { icpService } from '../services/icp.service';
import { usePrincipalId, useIsAuthenticated } from '../stores/authStore';
import { logger } from '@/utils/logger';
import { useToast } from '@/hooks/use-toast';
import { Principal } from '@propxchain/core-client';

import { TransactionStatusFilterOption, DateRangeFilter, AmountRangeFilter, TransactionFilters } from '../types/admin.types';
import { TRANSACTION_STATUSES } from '../types/transactionStatus';
import type { DashboardTab } from '../types/adminDashboard.types';

// UI components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Admin panels
import { SummaryCards } from '../components/admin/SummaryCards';
import { AdminTransactionsTab } from '../components/admin/AdminTransactionsTab';
import { UsersPanel } from '../components/admin/UsersPanel';
import { CanistersTable } from '../components/admin/CanistersTable';
import { LandRegistryPanel } from '../components/admin/LandRegistryPanel';
import { BudgetPanel } from '../components/admin/BudgetPanel';
import { EmailsPanel } from '../components/admin/EmailsPanel';
import { DocumentsPanel } from '../components/admin/DocumentsPanel';
import { PropertiesPanel } from '../components/admin/PropertiesPanel';
import { MessagesPanel } from '../components/admin/MessagesPanel';
import { AdminTabBar } from '../components/admin/AdminTabBar';
import { ConveyancersPanel } from '../components/admin/ConveyancersPanel';
import { SessionManager } from '../utils/sessionManager';

import AppTopBar from '@/components/navigation/AppTopBar';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const principalId = usePrincipalId();
  const isAuthenticated = useIsAuthenticated();
  const themeClasses = useThemeClasses();
  const { toggleTheme, isDark } = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Transaction filter state (needed for AdminTransactionsTab)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilterOption>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>({ preset: 'all-time' });
  const [amountRangeFilter, setAmountRangeFilter] = useState<AmountRangeFilter>({ preset: 'all' });

  // Gate all dashboard fetching on admin authorization. Fetching before the
  // authenticated agent is ready caused the summary canister fetch to reject
  // and the summary cards to render blank.
  const dashboard = useAdminDashboard({ ready: isAuthorized });
  const openTicketCount = useOpenTicketCount(isAuthorized);
  const { toast } = useToast();

  // Admin auth check (preserved from existing)
  useEffect(() => {
    if (!principalId || !isAuthenticated) return;

    const checkAdminAccess = async (): Promise<void> => {
      try {
        const isAuth = await icpService.initAuth();
        if (!isAuth) { navigate('/login'); return; }

        if (!icpService.userManagement) await icpService.initialize();

        // Single source of truth: user_management `admins` stable map.
        // Falls back to env-configured principal allowlist if the canister
        // query fails transiently.
        let isAdmin = false;
        try {
          isAdmin = await (await icpService.requireUserManagement()).amIAdmin();
        } catch (err) {
          logger.warn('amIAdmin() failed, falling back to env allowlist', err);
        }

        if (!isAdmin) {
          const { isAdminPrincipal } = await import('../constants/adminPrincipals');
          if (isAdminPrincipal(principalId)) isAdmin = true;
        }

        if (!isAdmin) {
          navigate('/dashboard');
          return;
        }

        setIsAuthorized(true);

        // Refresh canister-issued CSRF token for admin write paths
        // (PromoteAdminDialog / Users panel demote button).
        try {
          await icpService.fetchAndStoreCsrfToken();
          const token = SessionManager.getInstance().getCsrfToken();
          setCsrfToken(token);
        } catch (csrfErr) {
          logger.warn('CSRF token fetch failed for AdminDashboard', csrfErr);
        }
      } catch (error) {
        logger.error('Admin access check error:', error);
        navigate('/dashboard');
      }
    };

    checkAdminAccess();
  }, [principalId, isAuthenticated, navigate]);

  // Transaction filtering (same logic as existing)
  const statusCounts = useMemo<Record<TransactionStatusFilterOption, number>>(() => {
    const txns = dashboard.transactions;
    const counts = Object.fromEntries(TRANSACTION_STATUSES.map((s) => [s, txns.filter((tx) => tx.status === s).length]));
    return { all: txns.length, ...counts } as Record<TransactionStatusFilterOption, number>;
  }, [dashboard.transactions]);

  const filteredTransactions = useMemo(() => {
    return dashboard.transactions.filter(tx => {
      const matchesSearch = !searchTerm ||
        tx.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.propertyAddress?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [dashboard.transactions, searchTerm, statusFilter]);

  const handleFiltersChange = (filters: TransactionFilters): void => {
    setStatusFilter(filters.status);
    setDateRangeFilter(filters.dateRange);
    setAmountRangeFilter(filters.amountRange);
  };

  const handleClearFilters = (): void => {
    setStatusFilter('all');
    setDateRangeFilter({ preset: 'all-time' });
    setAmountRangeFilter({ preset: 'all' });
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
  };

  const getUserName = (id: string): string => {
    const user = dashboard.users.find(u => u.principal === id || u.id === id);
    return user?.name || id.substring(0, 8) + '...';
  };

  const handleDeleteTransaction = async (transactionId: string): Promise<void> => {
    const tx = dashboard.transactions.find(t => t.id?.toString() === transactionId);
    const label = tx?.propertyAddress || transactionId;
    const confirmed = window.confirm(
      `Force-delete transaction for "${label}"?\n\n` +
      `This removes the record from the canister state and cannot be undone. ` +
      `An audit log entry is written on-chain. Continue?`
    );
    if (!confirmed) return;

    const result = await icpService.adminForceDeleteTransaction(transactionId);
    if (result.ok) {
      toast({ title: 'Transaction deleted', description: label });
      await dashboard.refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: result.error || 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (principalText: string, displayName: string): Promise<void> => {
    if (!csrfToken) {
      toast({
        title: 'Delete failed',
        description: 'CSRF token unavailable — refresh the page and try again.',
        variant: 'destructive',
      });
      return;
    }
    const confirmed = window.confirm(
      `Delete user "${displayName}" (${principalText})?\n\n` +
      `This removes the user record from user_management. Their transactions are NOT deleted. ` +
      `An audit log entry is written on-chain. Continue?`
    );
    if (!confirmed) return;

    try {
      const target = Principal.fromText(principalText);
      const ok = await (await icpService.requireUserManagement()).deleteUserByPrincipal(target, csrfToken);
      if (ok) {
        toast({ title: 'User deleted', description: displayName });
        await dashboard.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: 'Canister rejected the request (not admin, bad CSRF token, or user not found).',
          variant: 'destructive',
        });
      }
    } catch (err) {
      logger.error('deleteUserByPrincipal failed', err);
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (!isAuthorized) return null;

  return (
    <div className={cn('min-h-screen', themeClasses.pageBg)}>
      <AppTopBar title="Admin dashboard" backTo="/dashboard" backLabel="Back to dashboard" isAdmin />

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className={cn('text-2xl font-bold', themeClasses.headerText)}>Admin Dashboard</h1>
            <Badge variant="outline">{dashboard.networkLabel}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {dashboard.lastUpdated && (
              <span className="text-sm text-muted-foreground">
                Last updated: {dashboard.lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/support')}>
              Support desk
              {openTicketCount > 0 && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
                  {openTicketCount}
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit')}>
              Portfolio Audit
            </Button>
            <Button variant="outline" size="sm" onClick={() => dashboard.refresh()}>
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {isDark ? '☀️' : '🌙'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards data={dashboard.summary} isLoading={dashboard.isSummaryLoading} />

        {/* Tabs */}
        <Tabs
          value={dashboard.activeTab}
          onValueChange={(v) => dashboard.setActiveTab(v as DashboardTab)}
        >
          <AdminTabBar
            activeTab={dashboard.activeTab}
            onTabChange={(t) => dashboard.setActiveTab(t)}
            unprocessedEmailCount={dashboard.unprocessedEmailCount}
          />

          <TabsContent value="transactions">
            <AdminTransactionsTab
              transactions={dashboard.transactions}
              filteredTransactions={filteredTransactions}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              dateRangeFilter={dateRangeFilter}
              amountRangeFilter={amountRangeFilter}
              statusCounts={statusCounts}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              onDeleteTransaction={handleDeleteTransaction}
              getUserName={getUserName}
              copyToClipboard={copyToClipboard}
            />
          </TabsContent>

          <TabsContent value="users">
            <UsersPanel
              users={dashboard.users}
              isLoading={dashboard.isUsersLoading}
              error={dashboard.errors.users}
              csrfToken={csrfToken ?? ''}
              onDeleteUser={handleDeleteUser}
            />
          </TabsContent>

          <TabsContent value="canisters">
            <CanistersTable
              canisters={dashboard.canisters}
              isLoading={dashboard.isCanistersLoading}
              error={dashboard.errors.canisters}
              onSetFreezingThreshold={dashboard.setFreezingThreshold}
            />
          </TabsContent>

          <TabsContent value="land-registry">
            <LandRegistryPanel
              credentialStatus={dashboard.lrCredentialStatus}
              apiHealth={dashboard.lrApiHealth}
              rateLimits={dashboard.lrRateLimits}
              pendingApplications={dashboard.lrPendingApplications}
              requisitions={dashboard.lrRequisitions}
              expiringSearches={dashboard.lrExpiringSearches}
              isLoading={dashboard.isLandRegistryLoading}
              error={dashboard.errors['land-registry']}
            />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetPanel
              budget={dashboard.budget}
              transactionCosts={dashboard.transactionCosts}
              isLoading={dashboard.isBudgetLoading}
              error={dashboard.errors.budget}
            />
          </TabsContent>

          <TabsContent value="emails">
            <EmailsPanel
              notifications={dashboard.emailNotifications}
              unprocessedCount={dashboard.unprocessedEmailCount}
              isLoading={dashboard.isEmailsLoading}
              error={dashboard.errors.emails}
              onMarkProcessed={dashboard.markEmailProcessed}
              onMarkAllProcessed={dashboard.markAllEmailsProcessed}
            />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsPanel
              storageStats={dashboard.storageStats}
              verificationStats={dashboard.verificationStats}
              expiredDocuments={dashboard.expiredLRDocuments}
              auditLogs={dashboard.auditLogs}
              isLoading={dashboard.isDocumentsLoading}
              error={dashboard.errors.documents}
            />
          </TabsContent>

          <TabsContent value="properties">
            <PropertiesPanel
              properties={dashboard.properties}
              isLoading={dashboard.isPropertiesLoading}
              error={dashboard.errors.properties}
            />
          </TabsContent>

          <TabsContent value="messages">
            <MessagesPanel
              stats={dashboard.messageStats}
              threads={dashboard.messageThreads}
              unreadCount={dashboard.messageUnreadCount}
              isLoading={dashboard.isMessagesLoading}
              error={dashboard.errors.messages}
            />
          </TabsContent>

          <TabsContent value="conveyancers">
            <ConveyancersPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
