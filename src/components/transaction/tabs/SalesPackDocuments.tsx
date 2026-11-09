// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The sales pack's "other documents" area. Documents are stored with the deal
 * (salesPackDocument.service) so they survive a change of device and are on the
 * deal's audit trail. Copies a seller added before that change live in this
 * browser's IndexedDB only; they are still listed, marked as such, so nothing a
 * seller added earlier silently disappears.
 */
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { web2DocumentService, type StoredDocument } from '@/services/web2-document.service';
import {
  SALES_PACK_ACCEPTED_TYPES,
  fetchSalesPackFile,
  listSalesPackDocuments,
  uploadSalesPackDocument,
  type SalesPackDocument,
} from '@/services/salesPackDocument.service';
import { PACK_DOC_KINDS, isPackDocument, packDocLabel } from '@/lib/packDocKinds';
import { fileExtension } from '@/lib/onChainDocument';

const BUTTON =
  'rounded-lg border border-teal-600/40 px-3 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-500/[0.08] disabled:opacity-50 dark:text-teal-300';

interface PackDocs {
  server: SalesPackDocument[];
  local: StoredDocument[];
  loadFailed: boolean;
  reload: () => Promise<void>;
}

function usePackDocuments(transactionId: string): PackDocs {
  const [server, setServer] = useState<SalesPackDocument[]>([]);
  const [local, setLocal] = useState<StoredDocument[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    const [serverResult, localResult] = await Promise.allSettled([
      listSalesPackDocuments(transactionId),
      web2DocumentService.getDocumentsByTransaction(transactionId),
    ]);
    if (serverResult.status === 'fulfilled') setServer(serverResult.value);
    setLoadFailed(serverResult.status === 'rejected');
    // A local read failure leaves the honest fallback: no local-only rows.
    if (localResult.status === 'fulfilled') {
      setLocal(localResult.value.filter((d) => isPackDocument(d.documentType)));
    }
  }, [transactionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { server, local, loadFailed, reload };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Save the stored bytes with a name built from the type, never the user's filename. */
function saveBlob(blob: Blob, doc: SalesPackDocument): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.label.replace(/[^a-z0-9]+/gi, '-')}-${doc.fileHash.slice(0, 8)}${fileExtension(doc.fileName)}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DocRow({ label, name, children }: { label: string; name: string; children?: ReactNode }): JSX.Element {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <FileUp className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
      <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      <span className="truncate">{name}</span>
      {children}
    </li>
  );
}

export function PackDocumentList({
  server,
  local,
}: { server: SalesPackDocument[]; local: StoredDocument[] }): JSX.Element | null {
  const [error, setError] = useState<string | null>(null);
  const open = async (doc: SalesPackDocument): Promise<void> => {
    setError(null);
    try {
      saveBlob(await fetchSalesPackFile(doc), doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file.');
    }
  };
  if (server.length === 0 && local.length === 0) return null;
  return (
    <>
      <ul className="mt-3 space-y-1.5" aria-label="Sales pack documents">
        {server.map((d) => (
          <DocRow key={d.id} label={d.label} name={d.fileName}>
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatDate(d.uploadedAt)}</span>
            <button type="button" onClick={() => void open(d)} className="ml-auto shrink-0 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300">
              Open<span className="sr-only"> {d.label}</span>
            </button>
          </DocRow>
        ))}
        {local.map((d) => (
          <DocRow key={d.id} label={packDocLabel(d.documentType)} name={d.fileName}>
            <span className="ml-auto shrink-0 text-xs text-amber-700 dark:text-amber-300">On this device only</span>
          </DocRow>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
    </>
  );
}

function PackUploadControls({
  transactionId,
  onUploaded,
}: { transactionId: string; onUploaded: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const kindId = useId();

  const handleFile = async (file: File): Promise<void> => {
    if (!kind) return;
    setBusy(true);
    setNotice(null);
    try {
      await uploadSalesPackDocument(file, { transactionId, kind });
      await onUploaded();
      setNotice(`${packDocLabel(kind)} added to the pack.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Upload failed — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label htmlFor={kindId} className="sr-only">Document type</label>
      <select
        id={kindId}
        value={kind}
        onChange={(e) => { setKind(e.target.value); setNotice(null); }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
      >
        <option value="">Choose document type</option>
        {PACK_DOC_KINDS.map((k) => (
          <option key={k.id} value={k.id}>{k.label}</option>
        ))}
      </select>
      <button type="button" disabled={busy || !kind} onClick={() => inputRef.current?.click()} className={BUTTON}>
        {busy ? 'Adding…' : 'Add a document'}
      </button>
      {notice && <p role="status" className="text-xs text-gray-600 dark:text-gray-400">{notice}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={SALES_PACK_ACCEPTED_TYPES.join(',')}
        className="hidden"
        data-testid="sales-pack-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function ExtraDocumentsSlot({
  transactionId,
  readOnly,
}: { transactionId: string; readOnly: boolean }): JSX.Element {
  const { server, local, loadFailed, reload } = usePackDocuments(transactionId);
  const isEmpty = server.length === 0 && local.length === 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700/60 dark:bg-white/[0.03]">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Other documents</p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        {readOnly
          ? 'Anything else the seller has added — floor plan, FENSA or gas certificates, warranties.'
          : 'Anything else a buyer should see — floor plan, FENSA or gas certificates, warranties. Stored securely with this deal, not on your device, and each file is fingerprinted on-chain for the audit trail.'}
      </p>
      {loadFailed && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Couldn&apos;t load the pack documents. Try again shortly.</p>
      )}
      {readOnly && !loadFailed && isEmpty && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nothing added yet.</p>
      )}
      <PackDocumentList server={server} local={local} />
      {!readOnly && <PackUploadControls transactionId={transactionId} onUploaded={reload} />}
    </div>
  );
}
