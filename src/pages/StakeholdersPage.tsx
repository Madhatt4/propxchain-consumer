import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSidebar from '../components/navigation/DashboardSidebar';
import DashboardHeader from '../components/navigation/DashboardHeader';
import { icpService } from '../services/icp.service';
import { InviteStakeholderModal } from '../components/dashboard/InviteStakeholderModal';

// shadcn-ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';
import { useAuthStore } from '../stores/authStore';

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'active' | 'pending' | 'completed';
  lastActivity?: string;
  documentsComplete?: boolean;
  uploadedDocuments?: string[];
  requiredDocuments?: string[];
}

const StakeholdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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
      setUser(currentUser);

      try {
        // Load user's transactions from canister
        await icpService.initialize();
        const allTransactions = await icpService.getAllTransactions();

        // Filter transactions where user is involved (including via invite code)
        const userTransactions = allTransactions.filter(tx =>
          tx.buyer === principalId ||
          tx.seller === principalId ||
          tx.createdBy === principalId ||
          tx.accessList?.includes(principalId)
        );

        logger.info('StakeholdersPage: User transactions:', userTransactions);
        setTransactions(userTransactions);

        // Auto-select first transaction
        if (userTransactions.length > 0) {
          setSelectedTransaction(userTransactions[0]);
          loadStakeholders(userTransactions[0], currentUser);
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
          loadStakeholders(userTransactions[0], currentUser);
        }
      }
    };

    loadData();
  }, [navigate]);

  const loadStakeholders = async (transaction: any, currentUser: any) => {
    if (!transaction) return;

    const parties: Stakeholder[] = [];

    try {
      // Try to load real-time stakeholder data from blockchain. The canister
      // keys members by the Text transaction id (`tx_<nanos>`); this used to
      // parseInt that to NaN and skip the call entirely.
      const txId = transaction.id;

      if (txId) {
        const members = await icpService.getTransactionMembers(txId);

        if (members && members.length > 0) {
          // Use real blockchain data
          for (const member of members) {
            const isCurrentUser = member.principal === currentUser.principal;
            const lastActivityDate = member.lastActivityAt ? new Date(Number(member.lastActivityAt) / 1000000) : null;

            parties.push({
              id: member.principal,
              name: isCurrentUser ? 'You' : `${member.role} (${member.principal.slice(0, 8)}...)`,
              role: member.role,
              status: member.documentsComplete ? 'completed' : 'active',
              lastActivity: lastActivityDate ? formatTimeAgo(lastActivityDate) : 'Unknown',
              documentsComplete: member.documentsComplete,
              uploadedDocuments: member.uploadedDocuments || [],
              requiredDocuments: member.requiredDocuments || [],
            });
          }

          setStakeholders(parties);
          return;
        }
      }
    } catch (error) {
      logger.error('Error loading stakeholders from blockchain:', error);
    }

    // Fallback to wizard data if blockchain query fails
    const userRole = transaction.wizardData?.userRole || transaction.userRole || 'buyer';

    // Add current user
    parties.push({
      id: currentUser.id,
      name: 'You',
      role: userRole,
      email: currentUser.email,
      status: 'active',
      lastActivity: 'Just now'
    });

    // Add conveyancer if selected
    if (transaction.wizardData?.conveyancer) {
      parties.push({
        id: 'conveyancer-1',
        name: transaction.wizardData.conveyancer.name || 'Conveyancer',
        role: 'solicitor',
        company: transaction.wizardData.conveyancer.company,
        email: transaction.wizardData.conveyancer.email,
        phone: transaction.wizardData.conveyancer.phone,
        status: 'active',
        lastActivity: 'Pending activity'
      });
    }

    // Add counterparty based on seller/buyer principal from transaction
    if (transaction.buyer && transaction.buyer !== currentUser.principal) {
      parties.push({
        id: transaction.buyer,
        name: `Buyer (${transaction.buyer.slice(0, 8)}...)`,
        role: 'buyer',
        status: 'active',
        lastActivity: 'Joined transaction'
      });
    }

    if (transaction.seller && transaction.seller !== currentUser.principal) {
      parties.push({
        id: transaction.seller,
        name: `Seller (${transaction.seller.slice(0, 8)}...)`,
        role: 'seller',
        status: 'active',
        lastActivity: 'Created transaction'
      });
    }

    // Add developer if applicable
    if (transaction.transactionType === 'new-build' && transaction.wizardData?.developerName) {
      parties.push({
        id: 'developer-1',
        name: transaction.wizardData.developerName || 'Developer',
        role: 'developer',
        company: transaction.wizardData.developerCompany,
        email: transaction.wizardData.developerEmail,
        status: 'active',
        lastActivity: 'Pending activity'
      });
    }

    // Add estate agent if selected
    if (transaction.wizardData?.hasAgent) {
      parties.push({
        id: 'agent-1',
        name: transaction.wizardData.agentName || 'Estate Agent',
        role: 'agent',
        company: transaction.wizardData.agentCompany,
        email: transaction.wizardData.agentEmail,
        phone: transaction.wizardData.agentPhone,
        status: 'completed',
        lastActivity: 'Pending activity'
      });
    }

    setStakeholders(parties);
  };

  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleTransactionSelect = (tx: any) => {
    setSelectedTransaction(tx);
    loadStakeholders(tx, user);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      buyer: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
      seller: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
      solicitor: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
      developer: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
      agent: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200'
    };
    return colors[role] || 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      pending: 'bg-yellow-500',
      completed: 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <DashboardHeader
        user={user}
        title="PropXchain"
        subtitle="Transaction Stakeholders"
      />

      {/* Main Content with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar activeRoute="/dashboard/stakeholders" />

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Transaction Stakeholders</h2>

        {transactions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">No transactions found</p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Complete the wizard to create your first transaction.</p>
              <Button
                size="lg"
                onClick={() => navigate('/create-transaction')}
              >
                Start New Transaction
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Transaction Selector */}
            <div className="lg:col-span-1">
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardDescription className="uppercase text-xs font-semibold">Select Transaction</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {transactions.map((tx) => (
                    <Button
                      key={tx.id}
                      variant={selectedTransaction?.id === tx.id ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start h-auto py-2 px-3",
                        selectedTransaction?.id === tx.id
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                      )}
                      onClick={() => handleTransactionSelect(tx)}
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm truncate">{tx.propertyAddress}</div>
                        <div className="text-xs opacity-75">{tx.transactionType}</div>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              {/* Stakeholder Summary */}
              {selectedTransaction && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="uppercase text-xs font-semibold">Summary</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Parties:</span>
                      <Badge variant="secondary">{stakeholders.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Active:</span>
                      <Badge className="bg-green-600 hover:bg-green-600">
                        {stakeholders.filter(s => s.status === 'active').length}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pending:</span>
                      <Badge className="bg-yellow-600 hover:bg-yellow-600">
                        {stakeholders.filter(s => s.status === 'pending').length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Stakeholder List */}
            <div className="lg:col-span-3">
              {selectedTransaction ? (
                <div className="space-y-6">
                  {/* Property Header */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedTransaction.propertyAddress}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {selectedTransaction.transactionType} · {stakeholders.length} {stakeholders.length === 1 ? 'party' : 'parties'} involved
                      </p>
                    </CardContent>
                  </Card>

                  {/* Stakeholder Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stakeholders.map((stakeholder) => (
                      <Card key={stakeholder.id} className="hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <Avatar className="w-12 h-12 bg-gray-200 dark:bg-gray-700">
                                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white font-bold">
                                  {getInitials(stakeholder.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="text-gray-900 dark:text-white font-semibold">{stakeholder.name}</h4>
                                <Badge className={cn("capitalize", getRoleColor(stakeholder.role))}>
                                  {stakeholder.role}
                                </Badge>
                              </div>
                            </div>
                            <div className={cn("w-3 h-3 rounded-full", getStatusColor(stakeholder.status))} title={stakeholder.status}></div>
                          </div>

                          {/* Contact Information */}
                          <div className="space-y-2">
                            {stakeholder.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-gray-700 dark:text-gray-300">{stakeholder.email}</span>
                              </div>
                            )}
                            {stakeholder.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span className="text-gray-700 dark:text-gray-300">{stakeholder.phone}</span>
                              </div>
                            )}
                            {stakeholder.company && (
                              <div className="flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span className="text-gray-700 dark:text-gray-300">{stakeholder.company}</span>
                              </div>
                            )}
                            {/* Document Progress */}
                            {stakeholder.requiredDocuments && stakeholder.requiredDocuments.length > 0 && (
                              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Documents</span>
                                  <span className="text-xs text-gray-700 dark:text-gray-300">
                                    {stakeholder.uploadedDocuments?.length || 0}/{stakeholder.requiredDocuments.length}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className={cn(
                                      "h-1.5 rounded-full transition-all",
                                      stakeholder.documentsComplete ? "bg-green-500" : "bg-gray-600"
                                    )}
                                    style={{
                                      width: `${((stakeholder.uploadedDocuments?.length || 0) / stakeholder.requiredDocuments.length) * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            {stakeholder.lastActivity && (
                              <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-gray-600 dark:text-gray-400">Last activity: {stakeholder.lastActivity}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            <Button size="sm" className="flex-1">
                              Contact
                            </Button>
                            <Button variant="secondary" size="sm">
                              View Profile
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      size="lg"
                      onClick={() => navigate(`/transaction/${selectedTransaction.id}`)}
                    >
                      View Transaction Details
                    </Button>
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setIsInviteModalOpen(true)}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Invite Stakeholder
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => navigate('/dashboard')}
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-700 dark:text-gray-300">Select a transaction from the list to view stakeholders</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Invite Modal */}
      {selectedTransaction && (
        <InviteStakeholderModal 
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          transactionId={selectedTransaction.id}
          transactionAddress={selectedTransaction.propertyAddress}
        />
      )}
    </div>
  );
};

export default StakeholdersPage;
