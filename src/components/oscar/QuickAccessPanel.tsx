import React, { useState, useEffect } from 'react';
import { FileText, Mail, TrendingUp, Loader2 } from 'lucide-react';
import { icpService } from '../../services/icp.service';
import { logger } from '@/utils/logger';
import { getStorePrincipalId } from '@/stores/authStore';

interface QuickAccessPanelProps {
  activeContext: { type?: string; id?: string; title?: string } | null;
  onSelectContext: (type: 'transaction' | 'document' | 'message', title?: string) => void;
}

interface QuickAccessCounts {
  transactions: number;
  documents: number;
  messages: number;
}

const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  activeContext,
  onSelectContext,
}) => {
  const [counts, setCounts] = useState<QuickAccessCounts>({
    transactions: 0,
    documents: 0,
    messages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    setLoading(true);
    try {
      // Initialize ICP service if needed
      await icpService.initialize();

      // Get user's principal ID
      const principalId = getStorePrincipalId();

      if (!principalId) {
        logger.warn('No principal ID found for quick access counts');
        setLoading(false);
        return;
      }

      // Fetch counts in parallel
      const [allTransactions] = await Promise.all([
        icpService.getAllTransactions().catch(() => []),
      ]);

      // Filter transactions for current user
      const userTransactions = allTransactions.filter(
        (tx: any) =>
          tx.buyer === principalId ||
          tx.seller === principalId ||
          tx.createdBy === principalId
      );

      // TODO: Fetch actual document and message counts
      // For now, we'll use placeholder counts
      setCounts({
        transactions: userTransactions.length,
        documents: 0, // Placeholder
        messages: 0, // Placeholder
      });
    } catch (error) {
      logger.error('Failed to load quick access counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (type: 'transaction' | 'document' | 'message', title: string) => {
    onSelectContext(type, title);
  };

  const quickAccessItems = [
    {
      type: 'transaction' as const,
      label: 'My Transactions',
      icon: TrendingUp,
      count: counts.transactions,
      description: 'View and ask about your property transactions',
      color: '#0d9488', // teal-600
    },
    {
      type: 'document' as const,
      label: 'My Documents',
      icon: FileText,
      count: counts.documents,
      description: 'Access your uploaded documents',
      color: '#0f766e', // teal-700
    },
    {
      type: 'message' as const,
      label: 'Messages',
      icon: Mail,
      count: counts.messages,
      description: 'Check your correspondence',
      color: '#14b8a6', // teal-500
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {quickAccessItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeContext?.type === item.type;

        return (
          <button
            key={item.type}
            onClick={() => handleClick(item.type, item.label)}
            className={`
              w-full flex items-start gap-3 p-3 rounded-lg transition-all text-left
              ${isActive
                ? 'bg-white border-l-3 border-teal-600 shadow-sm'
                : 'hover:bg-white hover:shadow-sm border-l-3 border-transparent'
              }
            `}
          >
            {/* Icon with color */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: `${item.color}15` }}
            >
              <Icon className="w-5 h-5" style={{ color: item.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`text-sm font-medium ${
                    isActive ? 'text-stone-900' : 'text-stone-600'
                  }`}
                >
                  {item.label}
                </span>

                {/* Count Badge */}
                {item.count > 0 && (
                  <span
                    className="px-2 py-0.5 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: `${item.color}20`,
                      color: item.color,
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-400 line-clamp-2">
                {item.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default QuickAccessPanel;
