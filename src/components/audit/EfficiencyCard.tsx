/**
 * Efficiency Card — blockchain vs traditional conveyancing comparison
 */

import React from 'react';
import { TrendingDown } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';

interface BlockchainEfficiencyMetrics {
  blockchainDays?: number;
  traditionalDays?: number;
  blockchainCost?: number;
  traditionalCost?: number;
  [key: string]: unknown;
}

interface EfficiencyCardProps {
  metrics: BlockchainEfficiencyMetrics | null;
}

const EfficiencyCard: React.FC<EfficiencyCardProps> = ({ metrics }) => {
  const theme = useThemeClasses();

  if (!metrics || (!metrics.blockchainDays && !metrics.blockchainCost)) {
    return null;
  }

  const hasDays = metrics.blockchainDays != null && metrics.traditionalDays != null;
  const hasCost = metrics.blockchainCost != null && metrics.traditionalCost != null;
  const daysSaved = hasDays
    ? (metrics.traditionalDays ?? 0) - (metrics.blockchainDays ?? 0)
    : 0;
  const pct = hasDays && (metrics.traditionalDays ?? 0) > 0
    ? Math.round(((metrics.blockchainDays ?? 0) / (metrics.traditionalDays ?? 1)) * 100)
    : 0;

  return (
    <div className={`rounded-lg p-4 ${theme.cardSecondary}`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="w-5 h-5 text-teal-500" />
        <h4 className={`font-fraunces font-semibold ${theme.textPrimary}`}>
          Efficiency Comparison
        </h4>
      </div>

      {hasDays && (
        <div className="mb-3">
          <p className={`text-sm ${theme.textSecondary} mb-1`}>
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {metrics.blockchainDays} days
            </span>
            {' '}on blockchain vs{' '}
            <span className={theme.textPrimary}>
              {metrics.traditionalDays} days
            </span>
            {' '}traditional
            {daysSaved > 0 && (
              <span className="text-green-600 dark:text-green-400 ml-1">
                ({daysSaved} days saved)
              </span>
            )}
          </p>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-teal-500 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {hasCost && (
        <p className={`text-sm ${theme.textSecondary}`}>
          <span className="font-semibold text-teal-600 dark:text-teal-400">
            &pound;{(metrics.blockchainCost ?? 0).toLocaleString()}
          </span>
          {' '}blockchain vs{' '}
          <span className={theme.textPrimary}>
            &pound;{(metrics.traditionalCost ?? 0).toLocaleString()}
          </span>
          {' '}traditional
        </p>
      )}
    </div>
  );
};

export default EfficiencyCard;
