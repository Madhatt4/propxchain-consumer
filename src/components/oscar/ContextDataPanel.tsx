import React, { useState, useEffect } from 'react';
import { X, Home, FileText, Mail, ChevronRight, Loader2 } from 'lucide-react';
import { icpService } from '../../services/icp.service';
import { logger } from '@/utils/logger';
import { getStorePrincipalId } from '@/stores/authStore';

interface ConversationContext {
  type?: 'transaction' | 'document' | 'message';
  id?: string;
  title?: string;
}

interface ContextDataPanelProps {
  context: ConversationContext;
  onClose: () => void;
  onSelectItem: (item: any, type: string) => void;
}

interface Transaction {
  id: string;
  propertyAddress?: string;
  status?: string;
  createdAt?: bigint;
  buyer?: string;
  seller?: string;
}

const ContextDataPanel: React.FC<ContextDataPanelProps> = ({
  context,
  onClose,
  onSelectItem,
}) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [context.type]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (context.type === 'transaction') {
        await icpService.initialize();
        const allTxs = await icpService.getAllTransactions();
        const principalId = getStorePrincipalId();

        // Filter to user's transactions
        const userTxs = allTxs.filter((tx: any) =>
          tx.buyer === principalId ||
          tx.seller === principalId ||
          tx.createdBy === principalId
        );
        setTransactions(userTxs);
      }
      // TODO: Add document and message loading in future phases
    } catch (err: any) {
      logger.error('Failed to load context data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: bigint | undefined) => {
    if (!timestamp) return 'N/A';
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'in_progress':
      case 'active':
        return 'bg-blue-500/20 text-blue-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const renderTitle = () => {
    switch (context.type) {
      case 'transaction':
        return 'My Transactions';
      case 'document':
        return 'My Documents';
      case 'message':
        return 'Messages';
      default:
        return 'Data';
    }
  };

  const renderIcon = () => {
    switch (context.type) {
      case 'transaction':
        return <Home className="w-5 h-5" />;
      case 'document':
        return <FileText className="w-5 h-5" />;
      case 'message':
        return <Mail className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const renderTransactionList = () => (
    <div className="space-y-3">
      {transactions.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No transactions found</p>
          <p className="text-sm mt-1">Start a new transaction to see it here</p>
        </div>
      ) : (
        transactions.map((tx) => (
          <button
            key={tx.id}
            onClick={() => onSelectItem(tx, 'transaction')}
            className="w-full text-left p-4 bg-[#1E293B] hover:bg-[#334155] rounded-lg transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {tx.propertyAddress || 'Property Transaction'}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  ID: {tx.id.slice(0, 8)}...
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Created: {formatDate(tx.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(tx.status)}`}>
                  {tx.status || 'Unknown'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  const renderDocumentList = () => (
    <div className="text-center text-gray-400 py-8">
      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Document list coming soon</p>
      <p className="text-sm mt-1">This feature is being built</p>
    </div>
  );

  const renderMessageList = () => (
    <div className="text-center text-gray-400 py-8">
      <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Message list coming soon</p>
      <p className="text-sm mt-1">This feature is being built</p>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-400 py-8">
          <p>Error: {error}</p>
          <button
            onClick={loadData}
            className="mt-3 text-sm text-[#6366F1] hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }

    switch (context.type) {
      case 'transaction':
        return renderTransactionList();
      case 'document':
        return renderDocumentList();
      case 'message':
        return renderMessageList();
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0F172A] border-r border-[#334155]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#334155]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6366F1]/20 rounded-lg flex items-center justify-center text-[#6366F1]">
            {renderIcon()}
          </div>
          <div>
            <h2 className="text-white font-semibold">{renderTitle()}</h2>
            <p className="text-gray-400 text-xs">
              {context.type === 'transaction' && `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
              {context.type === 'document' && 'Your uploaded documents'}
              {context.type === 'message' && 'Your conversations'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#1E293B] rounded-lg transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>

      {/* Footer hint */}
      <div className="p-4 border-t border-[#334155]">
        <p className="text-xs text-gray-500 text-center">
          Click an item to set it as Oscar's context
        </p>
      </div>
    </div>
  );
};

export default ContextDataPanel;
