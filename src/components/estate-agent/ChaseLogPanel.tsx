// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The agency's chase log on a listing (spec docs/plans/2026-09-06-agent-crm-spec.md,
 * R1.3, R2.6): calls and notes with a time, one next action with a due date.
 * Seen by the agency alone; each entry's hash goes on the ledger so the log
 * is on the trail without its text ever leaving the agency.
 */
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Link2, Loader2 } from 'lucide-react';
import { addChaseEntry, anchorChaseEntry, listChaseLog, markChaseDone, type ChaseEntry, type ChaseKind } from '@/services/chaseLog.service';
import { formatDueDate, formatEntryTime, KIND_LABELS } from './chaseLogFormat';

interface ChaseLogPanelProps {
  transactionId: string;
  listingId: string;
  organisationId: string;
}

const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-[DM_Sans] text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50';
const BUTTON_CLASS =
  'inline-flex min-h-9 items-center rounded-md bg-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-white hover:bg-[#0F766E] disabled:opacity-60';

/** "On the trail" once the hash is on the ledger; until then a retry, because the anchor is best-effort and nothing else re-sends it. */
function Anchor({ entry, onRetry, isRetrying }: { entry: ChaseEntry; onRetry: (id: string) => void; isRetrying: boolean }): JSX.Element {
  const onTrail = !!entry.ledgerHash && !entry.ledgerPending;
  if (onTrail) {
    return (
      <span data-testid="chase-anchor" data-anchored="true" className="inline-flex items-center gap-1 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400" title="The hash of this entry is on the ledger">
        <Link2 size={12} aria-hidden /> On the trail
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid="chase-anchor"
      data-anchored="false"
      disabled={isRetrying}
      onClick={() => onRetry(entry.id)}
      className="inline-flex items-center gap-1 font-[DM_Sans] text-xs text-gray-500 underline-offset-2 hover:underline disabled:opacity-60 dark:text-gray-400"
      title="Not on the ledger yet; press to try again"
    >
      {isRetrying ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Link2 size={12} aria-hidden />}
      {isRetrying ? 'Writing…' : 'Not on the trail yet, retry'}
    </button>
  );
}

interface EntryRowProps {
  entry: ChaseEntry;
  onDone: (id: string) => void;
  onRetry: (id: string) => void;
  markingId: string | null;
  retryingId: string | null;
}

function EntryRow({ entry, onDone, onRetry, markingId, retryingId }: EntryRowProps): JSX.Element {
  const isOpenAction = entry.kind === 'next_action' && !entry.doneAt;
  return (
    <li data-testid="chase-entry" data-kind={entry.kind} className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {KIND_LABELS[entry.kind]} · {formatEntryTime(entry.createdAt)}
          {entry.kind === 'next_action' && entry.dueAt ? ` · due ${formatDueDate(entry.dueAt)}` : ''}
          {entry.doneAt ? ' · done' : ''}
        </p>
        <Anchor entry={entry} onRetry={onRetry} isRetrying={retryingId === entry.id} />
      </div>
      <p className="mt-1 whitespace-pre-wrap font-[DM_Sans] text-sm text-gray-900 dark:text-gray-50">{entry.body}</p>
      {isOpenAction && (
        <button type="button" className={`mt-2 ${BUTTON_CLASS}`} disabled={markingId === entry.id} onClick={() => onDone(entry.id)}>
          <Check size={14} aria-hidden className="mr-1" /> Done
        </button>
      )}
    </li>
  );
}

export default function ChaseLogPanel({ transactionId, listingId, organisationId }: ChaseLogPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ChaseKind>('call');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['chase-log', transactionId],
    queryFn: () => listChaseLog(transactionId),
  });
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['chase-log', transactionId] });
    void queryClient.invalidateQueries({ queryKey: ['org-next-actions', organisationId] });
  };

  const add = useMutation({
    mutationFn: () =>
      addChaseEntry({
        orgId: organisationId, transactionId, listingId, kind, body,
        dueAt: kind === 'next_action' && dueAt ? new Date(`${dueAt}T09:00:00`).toISOString() : null,
      }),
    onSuccess: () => {
      setBody('');
      setDueAt('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save the entry.'),
  });
  const done = useMutation({
    mutationFn: (id: string) => markChaseDone(id),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not mark it done.'),
  });
  const retry = useMutation({
    mutationFn: (id: string) => anchorChaseEntry(id),
    onSuccess: (result) => {
      if (result.ledgerPending) setError('Still not on the ledger. Try again in a moment.');
      invalidate();
    },
  });

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!body.trim()) return;
    if (kind === 'next_action' && !dueAt) {
      setError('A next action needs a due date.');
      return;
    }
    add.mutate();
  };

  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700" data-testid="chase-log-panel">
      <h2 className="font-[Fraunces] text-lg font-semibold text-gray-900 dark:text-gray-50">Chase log</h2>
      <p className="mt-1 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
        Yours alone. Nobody on the deal sees it; each entry is anchored on the trail as a hash.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="chase-kind" className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">Entry</label>
            <select id="chase-kind" value={kind} onChange={(e) => setKind(e.target.value as ChaseKind)} className={FIELD_CLASS}>
              <option value="call">Call</option>
              <option value="note">Note</option>
              <option value="next_action">Next action</option>
            </select>
          </div>
          {kind === 'next_action' && (
            <div>
              <label htmlFor="chase-due" className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">Due</label>
              <input id="chase-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={FIELD_CLASS} />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="chase-body" className="block font-[DM_Sans] text-xs font-medium text-gray-500 dark:text-gray-400">What happened, or what to do</label>
          <textarea id="chase-body" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} className={FIELD_CLASS} />
        </div>
        <button type="submit" className={BUTTON_CLASS} disabled={add.isPending || !body.trim()}>
          {add.isPending ? 'Saving…' : 'Add to the log'}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">{error}</p>}
      {isLoading ? (
        <p className="mt-3 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">Loading the log…</p>
      ) : isError ? (
        <p role="alert" data-testid="chase-error" className="mt-3 font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">
          Could not load the log just now. Refresh to try again.
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-3 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400" data-testid="chase-empty">Nothing logged yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onDone={(id) => done.mutate(id)}
              onRetry={(id) => retry.mutate(id)}
              markingId={done.isPending ? done.variables ?? null : null}
              retryingId={retry.isPending ? retry.variables ?? null : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
