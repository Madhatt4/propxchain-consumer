// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Inline anomaly-flag indicator for TA6/TA7 form sections (Ship 3f).
 *
 * Renders a single CrossReferenceResult — severity drives colour
 * (critical=red, warning=amber, info=teal), message is primary, suggested
 * action is secondary. Matches PropertyIntelligenceCard typography
 * (Fraunces for headers elsewhere, DM Sans for body here).
 */
import type { ReactElement } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

import type { CrossReferenceResult } from '../../services/formCrossReferenceService';

export interface AnomalyFlagProps {
  result: CrossReferenceResult;
  /** Optional className applied to the outer container for layout tweaks. */
  className?: string;
}

interface SeverityStyle {
  container: string;
  iconColor: string;
  titleColor: string;
  Icon: typeof AlertCircle;
  srLabel: string;
}

const SEVERITY_STYLES: Record<CrossReferenceResult['severity'], SeverityStyle> = {
  critical: {
    container:
      'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30',
    iconColor: 'text-red-600 dark:text-red-400',
    titleColor: 'text-red-900 dark:text-red-200',
    Icon: AlertCircle,
    srLabel: 'Critical anomaly',
  },
  warning: {
    container:
      'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-900 dark:text-amber-200',
    Icon: AlertTriangle,
    srLabel: 'Warning anomaly',
  },
  info: {
    container:
      'border-[#0D9488]/20 bg-[#0D9488]/5 dark:border-[#14B8A6]/30 dark:bg-[#14B8A6]/10',
    iconColor: 'text-[#0D9488] dark:text-[#14B8A6]',
    titleColor: 'text-gray-900 dark:text-gray-100',
    Icon: Info,
    srLabel: 'Informational note',
  },
};

export function AnomalyFlag({ result, className = '' }: AnomalyFlagProps): ReactElement {
  const style = SEVERITY_STYLES[result.severity];
  const { Icon } = style;
  return (
    <div
      role="note"
      aria-label={`${style.srLabel}: ${result.message}`}
      data-testid={`anomaly-flag-${result.severity}`}
      className={`mt-3 flex gap-3 rounded-md border px-3 py-2.5 ${style.container} ${className}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.iconColor}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={`font-[DM_Sans] text-sm font-medium ${style.titleColor}`}>
          {result.message}
        </p>
        <p className="mt-1 font-[DM_Sans] text-xs text-gray-700 dark:text-gray-300">
          {result.suggestedAction}
        </p>
        <p className="mt-1 font-[DM_Sans] text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {result.formSection} · source: {result.propertyIntelSource}
        </p>
      </div>
    </div>
  );
}

export default AnomalyFlag;
