// Inline cross-reference anomaly flag for a single TA6 section. Mirrors the
// severity colour idea of the legacy AnomalyFlag but takes the lighter,
// canister-sourced anomaly shape ({ ref, severity, explanation }) surfaced via
// the TA6Form `anomalies` prop.

import type { ReactElement } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type StepAnomalySeverity = 'info' | 'warning' | 'conflict';

export interface StepAnomaly {
  ref: string;
  severity: StepAnomalySeverity;
  explanation: string;
}

export interface StepAnomalyFlagProps {
  anomaly: StepAnomaly;
}

interface SeverityStyle {
  container: string;
  iconColor: string;
  Icon: typeof AlertCircle;
  label: string;
}

const SEVERITY_STYLES: Record<StepAnomalySeverity, SeverityStyle> = {
  conflict: {
    container: 'border-red-200 bg-red-50',
    iconColor: 'text-red-600',
    Icon: AlertCircle,
    label: 'Conflict',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
    label: 'Warning',
  },
  info: {
    container: 'border-[#0D9488]/20 bg-[#0D9488]/5',
    iconColor: 'text-[#0D9488]',
    Icon: Info,
    label: 'Note',
  },
};

export function StepAnomalyFlag({ anomaly }: StepAnomalyFlagProps): ReactElement {
  const style = SEVERITY_STYLES[anomaly.severity];
  const { Icon } = style;
  return (
    <div
      role="note"
      aria-label={`${style.label} on ${anomaly.ref}: ${anomaly.explanation}`}
      data-testid={`ta6-anomaly-${anomaly.severity}`}
      className={`flex gap-3 rounded-md border px-3 py-2.5 ${style.container}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.iconColor}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{anomaly.explanation}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
          Cross-reference · {anomaly.ref}
        </p>
      </div>
    </div>
  );
}

export default StepAnomalyFlag;
