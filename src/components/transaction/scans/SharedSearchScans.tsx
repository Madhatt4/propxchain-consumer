// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The shared search scans on a transaction, one card per delivered search, shown
 * to every party without anyone pressing anything. Takes only a transaction id
 * so that any surface can mount it, the conveyancer's included.
 *
 * It reports what the documents say. Marc, 2026-10-31: "i don't want made up
 * enquiries", so nothing here suggests one or a next step, and flags (what a
 * document states) stay apart from warnings (what could not be read).
 */
import type { ReactNode } from 'react';
import { AlertTriangle, FileWarning, Flag, Info, Loader2, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSharedSearchScans } from '@/hooks/useScan';
import type { ScanFinding, SharedScanFlag, SharedSearchScan } from '@/types/scan.types';

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  groundsure: 'Groundsure',
  onesearch: 'OneSearch',
  tmgroup: 'TMGroup',
};

function StatusLine({ icon, children }: { icon: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function FlagList({ flags }: { flags: SharedScanFlag[] }): JSX.Element | null {
  if (flags.length === 0) return null;
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Flag className="h-4 w-4 text-warning" />
        <span className="text-sm font-semibold text-foreground">Flagged in the searches</span>
      </div>
      <ul className="space-y-2">
        {flags.map((flag, i) => (
          <li key={i} className="text-sm text-foreground/90">
            {flag.statement}
            <span className="block text-xs text-muted-foreground">
              {[flag.searchName, flag.location].filter(Boolean).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningList({ warnings }: { warnings: string[] }): JSX.Element | null {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-border p-4" data-testid="scan-warnings">
      <div className="mb-2 flex items-center gap-2">
        <FileWarning className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Couldn't read</span>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {warnings.map((warning, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonalDetails({ findings }: { findings: ScanFinding[] }): JSX.Element {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          Personal details: only you can see these
        </span>
      </div>
      <ul className="space-y-2">
        {findings.map((finding, i) => (
          <li key={i} className="text-sm text-foreground/90">
            {finding.label}: {finding.value}
            <span className="block text-xs text-muted-foreground">{finding.provenance}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonalCount({ scan }: { scan: SharedSearchScan }): JSX.Element | null {
  if (scan.personalFindings?.length) return <PersonalDetails findings={scan.personalFindings} />;
  const count = scan.personalFindingsCount;
  if (count === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {count === 1 ? '1 detail that identifies a person is' : `${count} details that identify a person are`}{' '}
      kept off this shared summary.
    </p>
  );
}

function ScanBody({ scan }: { scan: SharedSearchScan }): JSX.Element {
  if (scan.status === 'pending') {
    return (
      <StatusLine icon={<Loader2 className="h-4 w-4 animate-spin" />}>
        Being scanned. The summary will appear here by itself.
      </StatusLine>
    );
  }
  if (scan.status === 'error') {
    return (
      <StatusLine icon={<AlertTriangle className="h-4 w-4 text-destructive" />}>
        We couldn't scan this search this time. We try a few times automatically, so it may still
        appear here.
      </StatusLine>
    );
  }
  if (scan.status === 'unsupported') {
    return (
      <div className="space-y-4">
        <StatusLine icon={<Info className="h-4 w-4" />}>
          {scan.explainer || "We can't summarise this type of search automatically."}
        </StatusLine>
        <WarningList warnings={scan.warnings} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {scan.explainer && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{scan.explainer}</p>
      )}
      <FlagList flags={scan.flags} />
      <WarningList warnings={scan.warnings} />
      <PersonalCount scan={scan} />
    </div>
  );
}

function ScanCard({ scan }: { scan: SharedSearchScan }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Search summary: {PROVIDER_LABELS[scan.provider] ?? scan.provider}
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Scanned automatically and shared with everyone on this transaction.
        </p>
      </CardHeader>
      <CardContent>
        <ScanBody scan={scan} />
      </CardContent>
    </Card>
  );
}

export function SharedSearchScans({ transactionId }: { transactionId: string }): JSX.Element | null {
  const { data: scans, isError } = useSharedSearchScans(transactionId);

  if (isError) {
    return (
      <StatusLine icon={<AlertTriangle className="h-4 w-4 text-destructive" />}>
        We couldn't load the search summaries. Please refresh the page.
      </StatusLine>
    );
  }
  if (!scans || scans.length === 0) return null;

  return (
    <div className="space-y-4">
      {scans.map((scan) => (
        <ScanCard key={scan.id} scan={scan} />
      ))}
      <p className="text-xs text-muted-foreground">
        This is an automated summary of your searches, not legal advice.
      </p>
    </div>
  );
}
