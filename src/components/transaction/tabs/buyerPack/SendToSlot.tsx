// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Send to this deal" for the wallet documents a pack item needs. Uploads
 * happen in the PropXchain Wallet only (wallet decision 2); this just sends
 * what is already there, so the server-computed status can pick it up.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WALLET_PAGE_PATH } from '@/services/buyerPack.service';
import { transactionWalletService } from '@/services/transactionWallet.service';
import { vaultDocumentService } from '@/services/vaultDocument.service';
import { VAULT_SLOTS, type VaultDocument, type VaultSlotId } from '@/types/vault.types';

interface Props {
  transactionId: string;
  /** Pass a module-level constant: the effect keys on this array's identity. */
  slots: readonly VaultSlotId[];
  onSent: () => void;
}

const slotLabel = (id: VaultSlotId): string => VAULT_SLOTS.find((s) => s.id === id)?.label ?? id;
const shortDate = (iso: string): string => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function SendToSlot({ transactionId, slots, onSent }: Props): JSX.Element {
  const [candidates, setCandidates] = useState<VaultDocument[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([vaultDocumentService.listMyDocuments(), transactionWalletService.listSent(transactionId)])
      .then(([mine, sent]) => {
        if (!live) return;
        const sentIds = new Set(sent.map((s) => s.doc.id));
        setCandidates(mine.filter((d) => slots.includes(d.slotId) && !sentIds.has(d.id)));
      })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not read your wallet'); });
    return () => { live = false; };
  }, [transactionId, slots]);

  const send = async (doc: VaultDocument): Promise<void> => {
    setBusy(doc.id);
    setError(null);
    try {
      await transactionWalletService.send(transactionId, doc);
      setCandidates((c) => (c ?? []).filter((d) => d.id !== doc.id));
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-md border border-dashed p-3 text-sm">
      {candidates === null && !error && <p className="text-muted-foreground">Checking your wallet…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {candidates && candidates.length > 0 && (
        <ul className="space-y-1.5">
          {candidates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span>{slotLabel(d.slotId)} · uploaded {shortDate(d.uploadedAt)}</span>
              <Button type="button" size="sm" variant="outline" disabled={busy === d.id} onClick={() => void send(d)}>
                {busy === d.id ? 'Sending…' : 'Send to this deal'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {candidates && candidates.length === 0 && (
        <p className="text-muted-foreground">Nothing in your wallet under {slots.map(slotLabel).join(' or ')} yet.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        <Link to={WALLET_PAGE_PATH} className="underline">Upload to your PropXchain Wallet</Link>, then send it here.
      </p>
    </div>
  );
}
