// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * WalletDocumentUpload — one PropXchain Wallet slot's card. Lists the slot's
 * files (a slot holds many), enforces the tier caps, and lets custom slots be
 * named. Files live in owner-only account storage; only each file's hash is
 * anchored on-chain. Rows show date/size/type — never a filename (none is
 * stored). A custom slot's name is kept on-device and never anchored (ADR 0003).
 */
import React, { useEffect, useRef, useState } from 'react';
import { FileText, Fingerprint, Home, Landmark, ShieldCheck, Folder, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  vaultDocumentService,
  validateVaultFile,
  type VaultCaps,
} from '@/services/vaultDocument.service';
import {
  EXT_BY_MIME,
  WALLET_LABEL_MAX,
  type VaultDocument,
  type VaultSlot,
  type VaultSlotId,
} from '@/types/vault.types';
import { transactionWalletService } from '@/services/transactionWallet.service';
import { logger } from '@/utils/logger';
import { WalletFileRow } from './WalletFileRow';

/** Icon per slot — matches the Credentials-tab row language (icon square + name + detail + chip). */
const SLOT_ICON: Record<VaultSlotId, LucideIcon> = {
  amlSourceOfFunds: ShieldCheck,
  proofOfId: Fingerprint,
  decisionInPrinciple: FileCheck,
  mortgageOffer: Landmark,
  proofOfOwnership: Home,
  custom1: Folder,
  custom2: Folder,
};

interface WalletDocumentUploadProps {
  slot: VaultSlot;
  /** Every file currently held in this slot (newest first). */
  docs: VaultDocument[];
  /** Caller's principal — used to load/store a custom slot's local name. */
  principal: string;
  /** Tier caps: files per slot + total bytes. */
  caps: VaultCaps;
  onStored: (doc: VaultDocument) => void;
  onRemoved: (slotId: VaultSlotId, id: string) => void;
  /** Called after a label rename so the parent can update its copy of the doc. */
  onRelabelled?: (doc: VaultDocument) => void;
}

export function WalletDocumentUpload({
  slot,
  docs,
  principal,
  caps,
  onStored,
  onRemoved,
  onRelabelled,
}: WalletDocumentUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (slot.custom && principal) {
      setName(vaultDocumentService.getCustomSlotName(principal, slot.id) ?? '');
    }
  }, [slot.custom, slot.id, principal]);

  const maxFiles = caps.maxFilesPerSlot;
  const atCap = docs.length >= maxFiles;
  const displayLabel = slot.custom && name ? name : slot.label;

  const pick = (): void => {
    if (!isBusy && !atCap) inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;

    const validationError = validateVaultFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsBusy(true);
    try {
      const doc = await vaultDocumentService.storeDocument(file, slot, caps, label);
      setLabel('');
      onStored(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      logger.error('[vault] upload failed', message);
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const removeOne = async (doc: VaultDocument): Promise<void> => {
    setIsBusy(true);
    try {
      // Cascade (spec decision 10): revoke every share in every deal, then delete.
      await transactionWalletService.removeFromWalletEverywhere(doc);
      onRemoved(slot.id, doc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove document.');
    } finally {
      setIsBusy(false);
    }
  };

  const rename = async (doc: VaultDocument, next: string): Promise<void> => {
    try {
      const stored = await vaultDocumentService.setLabel(doc, next);
      const updated: VaultDocument = { ...doc };
      if (stored) updated.label = stored;
      else delete updated.label;
      onRelabelled?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the label.');
    }
  };

  const download = async (doc: VaultDocument): Promise<void> => {
    try {
      const blob = await vaultDocumentService.getFile(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeLabel = (doc.label ?? slot.label).replace(/[^a-z0-9]+/gi, '-');
      a.download = `${safeLabel}-${doc.fileHash.slice(0, 8)}${EXT_BY_MIME[doc.mimeType] ?? ''}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file.');
    }
  };

  const saveName = (): void => {
    vaultDocumentService.setCustomSlotName(principal, slot.id, name);
    setEditingName(false);
  };

  const Icon = SLOT_ICON[slot.id] ?? FileText;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {slot.custom && editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Name this slot"
                className="text-sm border border-border rounded px-2 py-1 bg-background"
              />
              <button
                type="button"
                onClick={saveName}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              {displayLabel}
              {slot.buyersOnlyNote && (
                <span className="text-xs font-normal text-muted-foreground">(buyers)</span>
              )}
              {slot.custom && (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-xs font-normal text-blue-600 hover:text-blue-800"
                >
                  {name ? 'Rename' : 'Name slot'}
                </button>
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{slot.description}</p>
        </div>
        <span
          className={
            docs.length > 0
              ? 'shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'
              : 'shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
          }
          title={`${docs.length} of ${maxFiles} files`}
        >
          {docs.length > 0 ? `${docs.length} / ${maxFiles}` : 'Empty'}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={onFile}
        disabled={isBusy}
      />

      {docs.length > 0 && (
        <div className="mt-3 space-y-2">
          {docs.map((doc) => (
            <WalletFileRow
              key={doc.id}
              doc={doc}
              busy={isBusy}
              onDownload={download}
              onRemove={removeOne}
              onRename={rename}
            />
          ))}
        </div>
      )}

      {!atCap && (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={WALLET_LABEL_MAX}
          placeholder={displayLabel}
          aria-label="Label for the next file (optional)"
          disabled={isBusy}
          className="mt-3 w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
        />
      )}

      <button
        type="button"
        onClick={pick}
        disabled={isBusy || atCap}
        className="mt-2 w-full border-2 border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:border-muted-foreground disabled:opacity-50"
      >
        {isBusy
          ? 'Uploading…'
          : atCap
            ? `Slot full (${maxFiles}) — upgrade for more`
            : 'Upload document (PDF, JPG, PNG · max 10MB)'}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default WalletDocumentUpload;
