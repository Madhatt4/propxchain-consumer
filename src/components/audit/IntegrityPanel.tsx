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

const IntegrityPanel: React.FC<IntegrityPanelProps> = ({ integrity }) => {
  const theme = useThemeClasses();
  const config = STATUS_CONFIG[integrity.overallStatus];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`w-6 h-6 ${config.text}`} />
        <h3 className={`font-fraunces text-lg font-semibold ${config.text}`}>
          {config.label}
        </h3>
      </div>
      <div className="flex flex-wrap gap-3">
        {Object.entries(integrity.canisterAvailability).map(([name, available]) => (
          <div key={name} className="flex items-center gap-1.5 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                available ? 'bg-green-600' : 'bg-red-600'
              }`}
            />
            <span className={theme.textSecondary}>
              {name.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrityPanel;
