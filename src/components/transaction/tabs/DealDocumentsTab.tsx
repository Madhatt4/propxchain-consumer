// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Documents on this deal" — every property document on the transaction, for
 * every party on it: buyer, seller, both conveyancers, the estate agent
 * (Marc, 2026-11-09: "I want docs to be seen in a transaction for
 * transparency"). Grouped by kind, each row says who uploaded it by role,
 * never by name.
 *
 * Personal documents (ID, bank, mortgage, AML, wallet files) are not here:
 * they stay in the Transaction Wallet and are shared through its grants. The
 * service filters them out even if a list ever returns one.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import type { TransactionTabProps } from './transactionTabs.config';
import {
  dealDocDownloadName,
  fetchDealDocumentFile,
  listDealDocuments,
  type DealDocument,
} from '@/services/dealDocuments.service';
import { DEAL_DOC_GROUPS } from '@/lib/dealDocumentKinds';
import { DealSurveyScans } from './DealSurveyScans';

const BUTTON =
  'rounded-lg border border-teal-600/40 px-3 py-1.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-500/[0.08] disabled:opacity-50 dark:text-teal-300';

// Some browsers start the download asynchronously after click(); revoking the
// URL straight away can cancel it, so the revoke waits.
const REVOKE_DELAY_MS = 10_000;

type LoadState = 'loading' | 'ready' | 'failed';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function saveBlob(blob: Blob, doc: DealDocument): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dealDocDownloadName(doc, blob.type);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

function useDealDocuments(transactionId: string): { docs: DealDocument[]; state: LoadState; reload: () => void } {
  const [docs, setDocs] = useState<DealDocument[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback((): void => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState('loading');
    listDealDocuments(transactionId).then(
      (rows) => {
        if (!active) return;
        setDocs(rows);
        setState('ready');
      },
      () => {
        if (active) setState('failed');
      },
    );
    return () => {
      active = false;
    };
  }, [transactionId, attempt]);

  return { docs, state, reload };
}

interface DocRowProps {
  doc: DealDocument;
  opening: boolean;
  error: string | null;
  onOpen: (doc: DealDocument) => void;
}

function DocRow({ doc, opening, error, onOpen }: DocRowProps): JSX.Element {
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <span className="font-semibold text-foreground">{doc.typeLabel}</span>
        <span className="min-w-0 truncate text-muted-foreground">{doc.fileName}</span>
        <span className="text-xs text-muted-foreground">
          {doc.uploadedByLabel}
          {formatDate(doc.uploadedAt) && ` · ${formatDate(doc.uploadedAt)}`}
        </span>
        <span className="ml-auto">
          {doc.canOpen ? (
            <button
              type="button"
              className={BUTTON}
              disabled={opening}
              onClick={() => onOpen(doc)}
              aria-label={`Open ${doc.typeLabel}`}
            >
              {opening ? 'Opening…' : 'Open'}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">No copy stored with the deal</span>
          )}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
    </li>
  );
}

function DocumentGroups({ docs }: { docs: DealDocument[] }): JSX.Element {
  const [opening, setOpening] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = async (doc: DealDocument): Promise<void> => {
    setOpening(doc.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    try {
      saveBlob(await fetchDealDocumentFile(doc), doc);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not open the file.';
      setErrors((prev) => ({ ...prev, [doc.id]: text }));
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-5">
      {DEAL_DOC_GROUPS.map(({ id, label }) => {
        const inGroup = docs.filter((d) => d.group === id);
        if (inGroup.length === 0) return null;
        return (
          <section key={id} aria-label={label}>
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            <ul className="divide-y divide-border">
              {inGroup.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  opening={opening === doc.id}
                  error={errors[doc.id] ?? null}
                  onOpen={(d) => void open(d)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function DealDocumentsTab({ transactionId }: TransactionTabProps): JSX.Element {
  const { docs, state, reload } = useDealDocuments(transactionId);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">Documents on this deal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Property documents everyone on the deal can see. Personal documents stay in each person&apos;s Transaction Wallet.
        </p>
      </header>

      {state === 'loading' && <p className="text-sm text-muted-foreground">Loading documents…</p>}
      {state === 'failed' && (
        <div role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          Could not load the documents on this deal.{' '}
          <button type="button" className="font-semibold underline" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {state === 'ready' && docs.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents shared on this deal yet.</p>
      )}
      {state === 'ready' && docs.length > 0 && <DocumentGroups docs={docs} />}

      <DealSurveyScans transactionId={transactionId} />
    </div>
  );
}

export default DealDocumentsTab;
