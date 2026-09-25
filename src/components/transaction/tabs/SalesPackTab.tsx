// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Sales pack — the transaction's assembled upfront-information artefact
 * (decisions: Madhatt4/Propxchain#115, #116). Free on starter; both parties
 * see it, the seller acts on it.
 *
 * v1 (slice 1) is the readiness meter plus an "other documents" slot that
 * follows the TA-upload idiom: bytes stay on this device, a SHA-256 hash is
 * kept with the metadata. Server-held copies, the share link and per-item
 * on-chain verification arrive with the share-link slice.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, FileUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePackReadiness } from '@/hooks/usePackReadiness';
import { web2DocumentService, type StoredDocument } from '@/services/web2-document.service';
import { ID_DOC_KIND, PACK_DOC_KINDS, isPackDocument, packDocLabel } from '@/lib/packDocKinds';
import { PackShareCard } from './PackShareCard';
import type { TransactionTabProps } from './transactionTabs.config';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

function ExtraDocumentsSlot({ transactionId }: { transactionId: string }): JSX.Element {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const kindId = useId();
  const isIdKind = kind === ID_DOC_KIND;

  useEffect(() => {
    let active = true;
    void web2DocumentService
      .getDocumentsByTransaction(transactionId)
      .then((all) => {
        if (active) setDocs(all.filter((d) => isPackDocument(d.documentType)));
      })
      .catch(() => {
        /* empty list is the honest fallback */
      });
    return () => {
      active = false;
    };
  }, [transactionId]);

  const handleFile = async (file: File): Promise<void> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice('PDF, JPG or PNG only.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setNotice('Files up to 10MB only.');
      return;
    }
    if (!kind || isIdKind) return;
    setBusy(true);
    setNotice(null);
    try {
      await web2DocumentService.uploadDocument(file, transactionId, kind);
      const all = await web2DocumentService.getDocumentsByTransaction(transactionId);
      setDocs(all.filter((d) => isPackDocument(d.documentType)));
      setNotice(`${packDocLabel(kind)} added to the pack.`);
    } catch {
      setNotice('Upload failed — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700/60 dark:bg-white/[0.03]">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Other documents</p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        Anything else a buyer should see — floor plan, FENSA or gas certificates,
        warranties. Stored on this device for now; hashed for the audit trail.
      </p>
      {docs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <FileUp className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
              <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{packDocLabel(d.documentType)}</span>
              <span className="truncate">{d.fileName}</span>
            </li>
          ))}
        </ul>
      )}
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
          <option value={ID_DOC_KIND}>Passport / driving licence / other ID</option>
        </select>
        {isIdKind ? (
          <Link
            to={`/transaction/${transactionId}/flow?tab=wallet`}
            className="rounded-lg border border-teal-600/40 px-3 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-500/[0.08] dark:text-teal-300"
          >
            Upload to Transaction Wallet
          </Link>
        ) : (
        <button
          type="button"
          disabled={busy || !kind}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-teal-600/40 px-3 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-500/[0.08] disabled:opacity-50 dark:text-teal-300"
        >
          {busy ? 'Adding…' : 'Add a document'}
        </button>
        )}
        {isIdKind && (
          <p className="basis-full text-xs text-gray-600 dark:text-gray-400">
            Identity documents never go in the pack. Keep them in your Transaction Wallet and share
            them with your conveyancer from there.
          </p>
        )}
        {notice && <p className="text-xs text-gray-600 dark:text-gray-400">{notice}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Stage where the seller confirms tenure and council tax band. */
const LIST_PROPERTY_STAGE_ID = 'seller-1';

const ROW_ACTION =
  'ml-auto shrink-0 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300';

interface SalesPackTabExtraProps {
  /** Jump to a flow stage — wired by the flow page; absent elsewhere. */
  onGoToStage?: (stageId: string) => void;
}

/**
 * Where an unfinished item is completed. Material info lives on the Stage 1
 * form (tenure and council tax band have no free source); proof of ID is
 * shared from the Transaction Wallet and is never part of the pack itself.
 */
function RowAction({
  itemId,
  transactionId,
  onGoToStage,
}: { itemId: string; transactionId: string; onGoToStage?: (stageId: string) => void }): JSX.Element | null {
  if (itemId === 'materialInfo' && onGoToStage) {
    return (
      <button type="button" className={ROW_ACTION} onClick={() => onGoToStage(LIST_PROPERTY_STAGE_ID)}>
        Complete in Stage 1
      </button>
    );
  }
  if (itemId === 'idShared') {
    return (
      <Link to={`/transaction/${transactionId}/flow?tab=wallet`} className={ROW_ACTION}>
        Share from wallet
      </Link>
    );
  }
  return null;
}

export function SalesPackTab({
  transactionId,
  onGoToStage,
}: TransactionTabProps & SalesPackTabExtraProps): JSX.Element {
  const { readiness, isLoading } = usePackReadiness(transactionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sales pack</h2>
          {readiness && (
            <span className="ml-auto text-sm font-semibold text-teal-700 dark:text-teal-300">
              {readiness.done} of {readiness.total}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The upfront information a buyer&apos;s side will ask for, gathered
          before they have to ask. Each item completes from its stage above.
        </p>

        {readiness && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={readiness.total}
            aria-valuenow={readiness.done}
            aria-label="Sales pack readiness"
            className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
          >
            <div
              className="h-full rounded-full bg-teal-500 transition-[width]"
              style={{ width: `${readiness.total ? (readiness.done / readiness.total) * 100 : 0}%` }}
            />
          </div>
        )}

        {isLoading && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking your pack…</p>
        )}

        {readiness && readiness.warnings.length > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              The title register disagrees with the listing
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              {readiness.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {readiness && (
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-slate-700/40">
            {readiness.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    'text-sm',
                    item.done
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400',
                  )}
                >
                  {item.label}
                </span>
                <span className="sr-only">{item.done ? 'done' : 'not done'}</span>
                {!item.done && (
                  <RowAction itemId={item.id} transactionId={transactionId} onGoToStage={onGoToStage} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ExtraDocumentsSlot transactionId={transactionId} />

      <PackShareCard transactionId={transactionId} />
    </div>
  );
}
