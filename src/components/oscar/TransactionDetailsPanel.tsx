import React, { useState, useEffect } from 'react';
import {
  X,
  Home,
  FileText,
  Users,
  Clock,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  MapPin,
  Building2,
  User,
  Mail,
} from 'lucide-react';
import { icpService } from '../../services/icp.service';
import { useSplitPanel } from '@/contexts/SplitPanelContext';
import { logger } from '@/utils/logger';
import { getStorePrincipalId } from '@/stores/authStore';
import { NewDocumentBadge, isNewDocument } from '@/components/documents/NewDocumentBadge';
import { acknowledgeDocument } from '@/utils/documentAcknowledgment';

interface TransactionDetailsPanelProps {
  transactionId: string;
  onClose: () => void;
  onAskOscar: (question: string, context: any) => void;
}

interface TransactionData {
  id: string;
  propertyAddress?: string;
  propertyType?: string;
  status?: string;
  mode?: string;
  createdAt?: bigint | number | string;
  updatedAt?: bigint | number | string;
  buyer?: string;
  seller?: string;
  createdBy?: string;
  amount?: number;
  deposit?: number;
  completionDate?: string;
  inviteCode?: string;
  parties?: any[];
  documents?: any[];
  milestones?: any[];
}

const TransactionDetailsPanel: React.FC<TransactionDetailsPanelProps> = ({
  transactionId,
  onClose,
  onAskOscar,
}) => {
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'parties' | 'timeline'>('overview');

  // Consume documents from context - no duplicate fetching
  const {
    transactionDocuments,
    documentsLoading,
    documentsError,
    selectedTransaction,
  } = useSplitPanel();

  useEffect(() => {
    loadTransactionDetails();
  }, [transactionId]);

  const loadTransactionDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      await icpService.initialize();

      // Fetch transaction details only - documents come from context
      const txData = await icpService.getTransaction(transactionId);
      if (txData) {
        // Normalise the canister record for this panel's view model: `status`
        // is a Candid variant ({ completion_initiated: null }) rendered as a
        // string, and the party fields are Principals rather than text.
        setTransaction({
          ...txData,
          status:
            typeof txData.status === 'string'
              ? txData.status
              : Object.keys(txData.status ?? {})[0],
          buyer: txData.buyer?.toString(),
          seller: txData.seller?.toString(),
          createdBy: txData.createdBy?.toString(),
          // Nat/Int on the canister; this view model works in JS numbers.
          amount: txData.amount != null ? Number(txData.amount) : undefined,
          deposit: txData.deposit != null ? Number(txData.deposit) : undefined,
        });
      }
    } catch (err: any) {
      logger.error('Failed to load transaction details:', err);
      setError(err.message || 'Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Helper to determine uploader display name
   * Handles Buyer, Seller, Solicitor, and current user
   */
  const getUploaderLabel = (uploadedBy: string): string => {
    const principalId = getStorePrincipalId();

    // Check if it's the current user
    if (uploadedBy === principalId) {
      return 'You';
    }

    // Check against transaction parties (use local transaction or selectedTransaction)
    const tx = transaction || selectedTransaction;
    if (tx) {
      // Get buyer principal as string
      const buyerStr = (tx as any).buyer?.toText?.() ||
                       (tx as any).buyer?.toString?.() ||
                       (tx as any).buyer;
      // Get seller principal as string
      const sellerStr = (tx as any).seller?.toText?.() ||
                        (tx as any).seller?.toString?.() ||
                        (tx as any).seller;
      // Get solicitor principal if assigned (check parties array or dedicated field)
      const solicitorPrincipal = (tx as any).solicitor?.toText?.() ||
                                 (tx as any).solicitor?.toString?.() ||
                                 (tx as any).solicitor ||
                                 // Also check parties array for solicitor role
                                 ((tx as any).parties || []).find(
                                   (p: any) => p.role?.toLowerCase() === 'solicitor'
                                 )?.principal;

      if (uploadedBy === buyerStr) return 'Buyer';
      if (uploadedBy === sellerStr) return 'Seller';
      if (solicitorPrincipal && uploadedBy === solicitorPrincipal) return 'Solicitor';
    }

    // Truncate unknown principal for display
    if (!uploadedBy || uploadedBy.length < 8) return uploadedBy || 'Unknown';
    return `${uploadedBy.substring(0, 8)}...`;
  };

  const formatDate = (timestamp: bigint | number | string | undefined) => {
    if (!timestamp) return 'N/A';
    let ms: number;
    if (typeof timestamp === 'bigint') {
      ms = Number(timestamp) / 1000000;
    } else if (typeof timestamp === 'number') {
      ms = timestamp > 1e12 ? timestamp / 1000000 : timestamp;
    } else {
      return timestamp;
    }
    return new Date(ms).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'blockchain_completed':
      case 'land_registry_registered':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30';
      case 'active':
      case 'exchanged':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30';
      case 'completion_initiated':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30';
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return 'Unknown';
    return status.replace(/-/g, ' ').replace(/_/g, ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getModeLabel = (mode: string | undefined) => {
    switch (mode?.toLowerCase()) {
      case 'diy':
        return 'DIY Conveyancing';
      case 'hybrid':
        return 'Hybrid (DIY + Support)';
      case 'professional':
        return 'Professional';
      default:
        return mode || 'Standard';
    }
  };

  const truncatePrincipal = (principal: string | undefined) => {
    if (!principal) return 'N/A';
    if (principal.length <= 20) return principal;
    return `${principal.slice(0, 10)}...${principal.slice(-8)}`;
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Property Info */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-stone-600 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Home className="w-4 h-4" />
          Property Details
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#6366F1] mt-0.5" />
            <div>
              <p className="text-stone-900 dark:text-white font-medium">{transaction?.propertyAddress || 'Address not available'}</p>
              <p className="text-stone-600 dark:text-gray-400 text-sm">{transaction?.propertyType || 'Property type not specified'}</p>
            </div>
          </div>
          {transaction?.amount && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-stone-900 dark:text-white font-medium">{formatCurrency(transaction.amount)}</p>
                <p className="text-stone-600 dark:text-gray-400 text-sm">Transaction value</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status & Mode */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-stone-600 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Transaction Info
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-stone-600 dark:text-gray-400 text-xs mb-1">Status</p>
            <span className={`inline-block text-xs px-2 py-1 rounded-full border ${getStatusColor(transaction?.status)}`}>
              {getStatusLabel(transaction?.status)}
            </span>
          </div>
          <div>
            <p className="text-stone-600 dark:text-gray-400 text-xs mb-1">Mode</p>
            <p className="text-stone-900 dark:text-white text-sm">{getModeLabel(transaction?.mode)}</p>
          </div>
          <div>
            <p className="text-stone-600 dark:text-gray-400 text-xs mb-1">Created</p>
            <p className="text-stone-900 dark:text-white text-sm">{formatDate(transaction?.createdAt)}</p>
          </div>
          {transaction?.completionDate && (
            <div>
              <p className="text-stone-600 dark:text-gray-400 text-xs mb-1">Completion</p>
              <p className="text-stone-900 dark:text-white text-sm">{transaction.completionDate}</p>
            </div>
          )}
        </div>
        {transaction?.inviteCode && (
          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-[#334155]">
            <p className="text-stone-600 dark:text-gray-400 text-xs mb-1">Invite Code</p>
            <p className="text-[#6366F1] font-mono text-sm">{transaction.inviteCode}</p>
          </div>
        )}
      </div>

      {/* Quick Actions for Oscar */}
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-stone-600 dark:text-gray-400 uppercase tracking-wide mb-3">
          Ask Oscar About This Transaction
        </h3>
        <div className="space-y-2">
          {[
            'What is the current status of this transaction?',
            'What documents are still needed?',
            'What are the next steps?',
            'How long until completion?',
          ].map((question, i) => (
            <button
              key={i}
              onClick={() => onAskOscar(question, transaction)}
              className="w-full text-left p-3 bg-stone-50 dark:bg-[#0F172A] hover:bg-stone-200 dark:hover:bg-[#334155] rounded-lg text-sm text-stone-700 dark:text-gray-300 hover:text-stone-900 dark:hover:text-white transition-colors flex items-center justify-between group"
            >
              <span>{question}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDocumentsTab = () => {
    // Use context documents
    const documents = transactionDocuments;
    const txId = transactionId || selectedTransaction?.id || '';

    return (
      <div className="space-y-4">
        {/* Loading state from context */}
        {documentsLoading && (
          <div className="text-center text-stone-600 dark:text-gray-400 py-4">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading documents...</p>
          </div>
        )}

        {/* Error state from context */}
        {documentsError && (
          <div className="text-center text-red-600 dark:text-red-400 py-4">
            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">{documentsError}</p>
          </div>
        )}

        {/* Empty state */}
        {!documentsLoading && !documentsError && documents.length === 0 ? (
          <div className="text-center text-stone-600 dark:text-gray-400 py-8">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No documents uploaded yet</p>
            <p className="text-sm mt-1">Documents will appear here once uploaded</p>
          </div>
        ) : (
          documents.map((doc, i) => {
            const docId = String(doc.id);
            const docIsNew = isNewDocument(txId, docId);

            return (
              <div
                key={doc.id || i}
                className="bg-white dark:bg-[#1E293B] rounded-lg p-4 cursor-pointer hover:bg-stone-100 dark:hover:bg-[#263449] transition-colors"
                onClick={() => {
                  // Acknowledge document when clicked/viewed
                  acknowledgeDocument(txId, docId);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="relative w-10 h-10 bg-[#6366F1]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#6366F1]" />
                    {docIsNew && <NewDocumentBadge count={1} dotOnly position="absolute" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-900 dark:text-white font-medium truncate">{doc.fileName || 'Document'}</p>
                    <p className="text-stone-600 dark:text-gray-400 text-xs mt-1">{doc.docType || 'Unknown type'}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-stone-500 dark:text-gray-500">
                      <span>Uploaded by: {getUploaderLabel(doc.uploadedBy)}</span>
                      <span>{formatDate(doc.uploadedAt)}</span>
                      {doc.fileSize > 0 && <span>{Math.round(Number(doc.fileSize) / 1024)} KB</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {doc.verified ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderPartiesTab = () => {
    const parties = transaction?.parties || [];
    const principalId = getStorePrincipalId();

    return (
      <div className="space-y-4">
        {/* Current user */}
        {principalId && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4 border border-[#6366F1]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#6366F1] rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-stone-900 dark:text-white font-medium">You</p>
                <p className="text-stone-600 dark:text-gray-400 text-xs font-mono">{truncatePrincipal(principalId)}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-[#6366F1]/20 text-[#6366F1]">
                {transaction?.createdBy === principalId ? 'Creator' : 'Participant'}
              </span>
            </div>
          </div>
        )}

        {/* Other parties */}
        {transaction?.seller && transaction.seller !== principalId && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-stone-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-stone-900 dark:text-white font-medium">Seller</p>
                <p className="text-stone-600 dark:text-gray-400 text-xs font-mono">{truncatePrincipal(transaction.seller)}</p>
              </div>
            </div>
          </div>
        )}

        {transaction?.buyer && transaction.buyer !== principalId && (
          <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-stone-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-stone-900 dark:text-white font-medium">Buyer</p>
                <p className="text-stone-600 dark:text-gray-400 text-xs font-mono">{truncatePrincipal(transaction.buyer)}</p>
              </div>
            </div>
          </div>
        )}

        {parties.map((party, i) => (
          <div key={i} className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-stone-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-stone-900 dark:text-white font-medium">{party.name || party.role || 'Party'}</p>
                {party.email && (
                  <p className="text-stone-600 dark:text-gray-400 text-xs flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {party.email}
                  </p>
                )}
              </div>
              {party.role && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {party.role}
                </span>
              )}
            </div>
          </div>
        ))}

        {parties.length === 0 && !transaction?.seller && !transaction?.buyer && (
          <div className="text-center text-stone-600 dark:text-gray-400 py-8">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No other parties yet</p>
            <p className="text-sm mt-1">Share the invite code to add parties</p>
          </div>
        )}
      </div>
    );
  };

  const renderTimelineTab = () => {
    const milestones = transaction?.milestones || [];

    return (
      <div className="space-y-4">
        {milestones.length === 0 ? (
          <div className="text-center text-stone-600 dark:text-gray-400 py-8">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No milestones recorded</p>
            <p className="text-sm mt-1">Timeline will appear as transaction progresses</p>
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-stone-200 dark:border-[#334155] space-y-6">
            {milestones.map((milestone, i) => (
              <div key={milestone.id || i} className="relative">
                <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full ${
                  milestone.status === 'completed' ? 'bg-green-500' :
                  milestone.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-500'
                }`} />
                <div className="bg-white dark:bg-[#1E293B] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-stone-900 dark:text-white font-medium">{milestone.name}</p>
                      <p className="text-stone-600 dark:text-gray-400 text-sm mt-1">{milestone.description}</p>
                    </div>
                    {milestone.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  {milestone.completedAt && (
                    <p className="text-stone-500 dark:text-gray-500 text-xs mt-2">
                      Completed: {formatDate(milestone.completedAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-stone-50 dark:bg-[#0F172A] border-r border-stone-200 dark:border-[#334155]">
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-[#334155]">
          <h2 className="text-stone-900 dark:text-white font-semibold">Transaction Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-[#1E293B] rounded-lg">
            <X className="w-5 h-5 text-stone-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-stone-50 dark:bg-[#0F172A] border-r border-stone-200 dark:border-[#334155]">
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-[#334155]">
          <h2 className="text-stone-900 dark:text-white font-semibold">Transaction Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-[#1E293B] rounded-lg">
            <X className="w-5 h-5 text-stone-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mb-3" />
          <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
          <button
            onClick={loadTransactionDetails}
            className="mt-4 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#5558E3] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-50 dark:bg-[#0F172A] border-r border-stone-200 dark:border-[#334155]">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 dark:border-[#334155]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6366F1]/20 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-[#6366F1]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-stone-900 dark:text-white font-semibold truncate">
                {transaction?.propertyAddress || 'Transaction'}
              </h2>
              <p className="text-stone-600 dark:text-gray-400 text-xs">ID: {transactionId.slice(0, 12)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 dark:hover:bg-[#1E293B] rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5 text-stone-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-[#1E293B] rounded-lg p-1">
          {(['overview', 'documents', 'parties', 'timeline'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-[#6366F1] text-white'
                  : 'text-stone-600 dark:text-gray-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-[#334155]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
        {activeTab === 'parties' && renderPartiesTab()}
        {activeTab === 'timeline' && renderTimelineTab()}
      </div>
    </div>
  );
};

export default TransactionDetailsPanel;
