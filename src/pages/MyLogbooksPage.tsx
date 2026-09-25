// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * MyLogbooksPage — "Your property logbook". Lists the caller's UPRN-keyed,
 * append-only logbooks (created free at completion, owned by the homeowner's
 * principal) with a chronological plain-English entry timeline. Degrades to a
 * calm "coming soon" state while the property_logbook canister is not yet on
 * mainnet (VITE_LOGBOOK_CANISTER_ID unset).
 */
import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import AppTopBar from '@/components/navigation/AppTopBar';
import { getMyLogbooks } from '../services/logbook.service';
import {
  describeEntry,
  formatLogbookDate,
  EVIDENCE_LABEL,
  type Logbook,
  type LogbookEntry,
} from '../types/logbook.types';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'unavailable' }
  | { phase: 'ready'; logbooks: Logbook[] };

function EntryRow({ entry }: { entry: LogbookEntry }): JSX.Element {
  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-border pl-4 py-2">
      <p className="text-sm text-foreground">{describeEntry(entry)}</p>
      <p className="text-xs text-muted-foreground">{formatLogbookDate(entry.recordedAt)}</p>
      <p className="inline-flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300">
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
        {EVIDENCE_LABEL[entry.evidence]}
      </p>
    </li>
  );
}

function LogbookCard({
  logbook,
  expanded,
  onToggle,
}: {
  logbook: Logbook;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  // Append-only entries, shown oldest-first as a timeline.
  const entries = [...logbook.entries].sort((a, b) =>
    a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0,
  );
  const identity = logbook.entries.find((e) => e.claim.kind === 'propertyIdentity');
  const title =
    identity && identity.claim.kind === 'propertyIdentity'
      ? `${identity.claim.addressLine}, ${identity.claim.postcode}`
      : `Property ${logbook.uprn}`;

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
          UPRN {logbook.uprn}
        </span>
      </button>
      {expanded && (
        <ul className="space-y-1 px-4 pb-4 pt-1">
          {entries.map((entry) => (
            <EntryRow key={entry.id.toString()} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MyLogbooksPage(): JSX.Element {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [expandedUprn, setExpandedUprn] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      // The service never throws — it degrades to 'unavailable'.
      const result = await getMyLogbooks();
      if (!active) return;
      if (result.status === 'ok') {
        setState({ phase: 'ready', logbooks: result.logbooks });
        // A single logbook is the overwhelmingly common case — open it.
        if (result.logbooks.length === 1) setExpandedUprn(result.logbooks[0].uprn);
      } else {
        setState({ phase: 'unavailable' });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppTopBar title="Property logbook" backTo="/dashboard" backLabel="Back to dashboard" />
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-7 w-7" /> Your property logbook
            </h2>
            <p className="text-muted-foreground mt-1">
              A permanent, append-only record of your home — created free when your purchase
              completes, and it stays with the home.
            </p>
          </div>

          {state.phase === 'loading' && (
            <p className="text-sm text-muted-foreground">Loading your logbooks…</p>
          )}

          {state.phase === 'unavailable' && (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="font-medium text-foreground">Property logbooks are coming soon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When they launch, a logbook is created automatically and free at completion, and
                every record is held on the Internet Computer.
              </p>
            </div>
          )}

          {state.phase === 'ready' && state.logbooks.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Your property logbook starts automatically when a purchase completes — free, and it
                stays with the home.
              </p>
            </div>
          )}

          {state.phase === 'ready' && state.logbooks.length > 0 && (
            <div className="space-y-4">
              {state.logbooks.map((logbook) => (
                <LogbookCard
                  key={logbook.uprn}
                  logbook={logbook}
                  expanded={expandedUprn === logbook.uprn}
                  onToggle={() =>
                    setExpandedUprn((cur) => (cur === logbook.uprn ? null : logbook.uprn))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
