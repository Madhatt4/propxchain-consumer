// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * One scan finding. PII HARD RULE: a `personal_data: true` finding's value is
 * never rendered in plain view — it's redacted and marked conveyancer-only.
 */
import { EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Confidence, FindingSeverity, ScanFinding } from '@/types/scan.types';

const CONFIDENCE_VARIANT: Record<Confidence, 'success' | 'warning' | 'secondary'> = {
  high: 'success',
  medium: 'warning',
  low: 'secondary',
};

const SEVERITY_VARIANT: Record<FindingSeverity, 'secondary' | 'warning' | 'destructive'> = {
  info: 'secondary',
  attention: 'warning',
  action: 'destructive',
};

export function ScanFindingRow({ finding }: { finding: ScanFinding }): JSX.Element {
  const redacted = finding.personal_data;
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{finding.label}</span>
        <div className="flex items-center gap-1.5">
          {finding.severity && (
            <Badge variant={SEVERITY_VARIANT[finding.severity]} className="capitalize">
              {finding.severity}
            </Badge>
          )}
          <Badge variant={CONFIDENCE_VARIANT[finding.confidence]} className="capitalize">
            {finding.confidence} confidence
          </Badge>
        </div>
      </div>

      {redacted ? (
        <span className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" />
          Personal data — shared with your conveyancer only
        </span>
      ) : (
        <span className="text-sm text-foreground/90">{finding.value}</span>
      )}

      <span className="text-xs text-muted-foreground">{finding.provenance}</span>
    </div>
  );
}
