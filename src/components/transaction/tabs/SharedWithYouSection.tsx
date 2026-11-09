// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * SharedWithYouSection — personal documents other parties on this deal have
 * chosen to share with you (Marc, 2026-11-09). The consumer twin of the
 * conveyancer portal's section, for buyers, sellers and estate agents.
 * Revoked or expired shares simply drop out of the list (server-side).
 */
import { useEffect, useState } from 'react';
import { Download, Inbox } from 'lucide-react';
import {
  downloadSharedDoc,
  listSharedWithMe,
  sharedDocLabel,
  type SharedWithMeDoc,
} from '@/services/sharedWithMe.service';
import { logger } from '@/utils/logger';

function accessEnds(expiresAt: string | null): string {
  if (!expiresAt) return '';
  return ` · access ends ${new Date(expiresAt).toLocaleDateString('en-GB')} — download your copy`;
}

function saveBlob(blob: Blob, objectPath: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = objectPath.split('/').pop() ?? 'document';
  a.click();
  window.URL.revokeObjectURL(url);
}

function SharedDocList({
  docs,
  onOpen,
}: {
  docs: SharedWithMeDoc[];
  onOpen: (doc: SharedWithMeDoc) => void;
}): JSX.Element {
  return (
    <ul className="mt-2 divide-y divide-border">
      {docs.map((doc) => (
        <li key={doc.objectPath} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{sharedDocLabel(doc.slotId)}</p>
            <p className="text-[11px] text-muted-foreground">
              Shared {new Date(doc.sharedAt).toLocaleDateString('en-GB')} · consent logged on-chain
              {accessEnds(doc.expiresAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpen(doc)}
            aria-label={`Download ${sharedDocLabel(doc.slotId)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-teal-600 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SharedWithYouSection({ transactionId }: { transactionId: string }): JSX.Element {
  const [docs, setDocs] = useState<SharedWithMeDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listSharedWithMe(transactionId)
      .then((rows) => {
        if (active) setDocs(rows);
      })
      .catch((err: unknown) => {
        logger.error('[sharedWithYou] listing failed', err);
        if (active) setError('Could not load documents shared with you.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [transactionId]);

  const handleOpen = async (doc: SharedWithMeDoc): Promise<void> => {
    setError(null);
    try {
      saveBlob(await downloadSharedDoc(doc.objectPath), doc.objectPath);
    } catch (err) {
      logger.error('[sharedWithYou] download failed', err);
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="shared-with-you-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="shared-with-you-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Inbox className="h-4 w-4 text-teal-700" /> Shared with you
        </h3>
        <span className="text-xs text-muted-foreground">{docs.length}</span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-amber-800">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nobody has shared a personal document with you on this deal yet.</p>
      ) : (
        <SharedDocList docs={docs} onOpen={(d) => void handleOpen(d)} />
      )}
    </section>
  );
}
