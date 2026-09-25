/**
 * Chain Position Card — shows linked transactions in a property chain
 */

import React from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';

interface ChainEntry {
  transactionId?: string;
  address?: string;
  status?: string;
  [key: string]: unknown;
}

interface ChainPositionCardProps {
  chainData: ChainEntry[] | null;
  currentTransactionId: string;
}

function getStatusBadge(status: string | undefined): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'active':
    case 'in_progress':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

const ChainPositionCard: React.FC<ChainPositionCardProps> = ({
  chainData,
  currentTransactionId,
}) => {
  const theme = useThemeClasses();

  if (!chainData || chainData.length === 0) {
    return (
      <div className={`flex items-center gap-2 py-6 justify-center ${theme.textTertiary}`}>
        <Link2 className="w-4 h-4" />
        <span>Not part of a property chain</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chainData.map((entry, idx) => {
        const isCurrent = entry.transactionId === currentTransactionId;
        return (
          <React.Fragment key={entry.transactionId ?? idx}>
            {idx > 0 && (
              <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <div
              className={`rounded-lg p-3 border-2 min-w-[140px] ${
                isCurrent
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                  : `border-transparent ${theme.cardSecondary}`
              }`}
            >
              <p
                className={`text-sm font-medium truncate ${
                  isCurrent ? 'text-teal-700 dark:text-teal-300' : theme.textPrimary
                }`}
              >
                {entry.address ?? 'Unknown address'}
              </p>
              {entry.status && (
                <span
                  className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${getStatusBadge(entry.status)}`}
                >
                  {entry.status}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ChainPositionCard;
