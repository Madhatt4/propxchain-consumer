// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * WalletFileRow — one file inside a PropXchain Wallet slot card. Title is the
 * owner-only label (decision 18) or "Uploaded <date>" when unlabelled; the
 * subline is size · type · hash. Never a filename (none is stored). Offers
 * Rename (label), Download and a confirm-guarded Remove.
 */
import { useState } from 'react';
import type { VaultDocument } from '@/types/vault.types';
import { WALLET_LABEL_MAX } from '@/types/vault.types';

function truncateHash(hash: string): string {
  return hash.length <= 16 ? hash : `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_BY_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
};

interface WalletFileRowProps {
  doc: VaultDocument;
  busy: boolean;
  onDownload: (doc: VaultDocument) => void;
  onRemove: (doc: VaultDocument) => void;
  onRename: (doc: VaultDocument, label: string) => Promise<void>;
}

const linkBtn = 'text-xs font-medium disabled:opacity-50';

export function WalletFileRow({
  doc,
  busy,
  onDownload,
  onRemove,
  onRename,
}: WalletFileRowProps): JSX.Element {
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(doc.label ?? '');
  const [draft, setDraft] = useState(doc.label ?? '');
  const uploaded = new Date(doc.uploadedAt).toLocaleDateString();
  const title = label || `Uploaded ${uploaded}`;

  const save = async (): Promise<void> => {
    await onRename(doc, draft);
    setLabel(draft.trim());
    setEditing(false);
  };

  return (
    <div className="border border-border rounded-md p-3 bg-background">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={WALLET_LABEL_MAX}
                placeholder="Label this file"
                className="text-sm border border-border rounded px-2 py-1 bg-background"
              />
              <button type="button" onClick={() => void save()} disabled={busy} className={`${linkBtn} text-blue-600 hover:text-blue-800`}>
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={busy} className={`${linkBtn} text-muted-foreground`}>
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm text-foreground truncate">{title}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {label ? `Uploaded ${uploaded} · ` : ''}
            {formatBytes(doc.fileSize)} · {KIND_BY_MIME[doc.mimeType] ?? 'File'} · Hash{' '}
            {truncateHash(doc.fileHash)}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} disabled={busy} className={`${linkBtn} text-muted-foreground hover:text-foreground`}>
              Rename
            </button>
          )}
          <button type="button" onClick={() => onDownload(doc)} disabled={busy} className={`${linkBtn} text-blue-600 hover:text-blue-800`}>
            Download
          </button>
          <button type="button" onClick={() => setConfirm(true)} disabled={busy} className={`${linkBtn} text-red-600 hover:text-red-800`}>
            Remove
          </button>
        </div>
      </div>
      {confirm && (
        <div className="mt-2 p-2 border border-red-200 bg-red-50 rounded text-xs">
          <p className="text-red-800">
            Remove this file from your wallet? It is also removed from every deal you sent it to and
            any sharing is revoked. The on-chain hash stays as an audit anchor.
          </p>
          <div className="flex gap-3 justify-end mt-2">
            <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="text-gray-700 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm(false);
                onRemove(doc);
              }}
              disabled={busy}
              className="text-white bg-red-600 px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
