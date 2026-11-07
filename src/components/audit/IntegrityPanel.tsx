/**
 * Integrity Panel — shows overall blockchain verification status
 * Green (verified), amber (warning), red (discrepancy)
 */

import React from 'react';
import { Shield, AlertTriangle, AlertCircle } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import type { IntegrityVerification } from '../../services/transactionAudit';

interface IntegrityPanelProps {
  integrity: IntegrityVerification;
}

const STATUS_CONFIG = {
  verified: {
    icon: Shield,
    label: 'All data verified',
    border: 'border-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-600',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Some data unavailable',
    border: 'border-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  discrepancy: {
    icon: AlertCircle,
    label: 'Discrepancies found',
    border: 'border-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-600',
  },
} as const;

// What each source holds, in the words a home mover uses.
const SOURCE_LABELS: Record<string, string> = {
  transaction_manager: 'transaction record',
  document_storage: 'document list',
  ledger_manager: 'event log',
};

function sourceLabel(name: string): string {
  return SOURCE_LABELS[name] ?? name.replace(/_/g, ' ');
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const IntegrityPanel: React.FC<IntegrityPanelProps> = ({ integrity }) => {
  const theme = useThemeClasses();
  const config = STATUS_CONFIG[integrity.overallStatus];
  const Icon = config.icon;
  const unreadable = Object.entries(integrity.canisterAvailability)
    .filter(([, available]) => !available)
    .map(([name]) => sourceLabel(name));

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`w-6 h-6 ${config.text}`} />
        <h3 className={`font-fraunces text-lg font-semibold ${config.text}`}>
          {config.label}
        </h3>
      </div>
      {unreadable.length > 0 && (
        <p className={`mb-3 text-sm ${theme.textSecondary}`}>
          We couldn&rsquo;t load the {joinWithAnd(unreadable)} just now. That is a
          connection problem, not a problem with your transaction. Reload the page in a
          minute; if it keeps happening, contact support.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {Object.entries(integrity.canisterAvailability).map(([name, available]) => (
          <div key={name} className="flex items-center gap-1.5 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                available ? 'bg-green-600' : 'bg-red-600'
              }`}
            />
            <span className={theme.textSecondary}>
              {sourceLabel(name)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrityPanel;
