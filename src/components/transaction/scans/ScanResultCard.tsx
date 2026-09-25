// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Shared renderer for one scan panel. Handles every state — loading (skeleton),
 * error (with retry), empty (prompt to run), unsupported, and ready (explainer
 * + findings + a SEPARATE conveyancer-flags list). Pure presentation: it reads
 * a `ScanResult`, it never derives findings and never logs scan content.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, FileQuestion, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScanRunResult, ScanResult } from '@/types/scan.types';
import { ScanFindingRow } from './ScanFindingRow';
import { ConveyancerFlags } from './ConveyancerFlags';

interface ScanResultCardProps {
  heading: string;
  description: string;
  trigger: ReactNode;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** A search/survey run ({status, result}), a bare HMLR result, or null. */
  run?: ScanRunResult | null;
  result?: ScanResult | null;
}

function StateBox({ icon, children }: { icon: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
      {icon}
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function ScanBody({ result }: { result: ScanResult }): JSX.Element {
  return (
    <div className="space-y-4">
      {result.explainer && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {result.explainer}
        </p>
      )}
      {result.findings.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="px-4">
            {result.findings.map((f) => (
              <ScanFindingRow key={f.key} finding={f} />
            ))}
          </div>
        </div>
      )}
      <ConveyancerFlags flags={result.flags_for_conveyancer} />
    </div>
  );
}

export function ScanResultCard(props: ScanResultCardProps): JSX.Element {
  const { heading, description, trigger, isLoading, error, onRetry, run, result } = props;
  const resolved: ScanResult | null = result ?? run?.result ?? null;
  const unsupported = run?.status === 'unsupported';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">{heading}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{trigger}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <StateBox icon={<AlertTriangle className="h-6 w-6 text-destructive" />}>
            <span className="block font-medium text-foreground">Scan failed</span>
            {error}
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                Try again
              </Button>
            )}
          </StateBox>
        ) : unsupported && resolved ? (
          <StateBox icon={<Info className="h-6 w-6 text-muted-foreground" />}>
            {resolved.explainer}
          </StateBox>
        ) : resolved ? (
          <ScanBody result={resolved} />
        ) : (
          <StateBox icon={<FileQuestion className="h-6 w-6 text-muted-foreground" />}>
            Nothing scanned yet. Use the button above to run this scan — it's free.
          </StateBox>
        )}
      </CardContent>
    </Card>
  );
}
