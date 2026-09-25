// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * ProofQrPanel — "Show a proof" for a deal's Transaction Wallet (wallet spec
 * decisions 4, 12, 13). The owner ticks which SENT documents to include, gets a
 * QR + link that opens the public proof-only page (existence + on-chain anchor,
 * never the file), sees active proofs with view counts, and can revoke any.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X } from 'lucide-react';
import { walletProofService, type ProofLink, PROOF_TTL_HOURS } from '@/services/walletProof.service';
import type { SentItem } from '@/services/transactionWallet.service';
import { slotDisplayLabel } from '@/utils/vaultSlotLabel';
import { logger } from '@/utils/logger';

interface ProofQrPanelProps {
  transactionId: string;
  principal: string;
  sent: SentItem[];
  active: ProofLink[];
  onCreated: (link: ProofLink) => void;
  onRevoked: (link: ProofLink) => void;
  onClose: () => void;
}

const fmt = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function ProofQrPanel({
  transactionId,
  principal,
  sent,
  active,
  onCreated,
  onRevoked,
  onClose,
}: ProofQrPanelProps): JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(new Set(sent.map((s) => s.doc.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ProofLink | null>(null);
  const [qr, setQr] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!current) return;
    let live = true;
    void QRCode.toDataURL(walletProofService.proofUrlFor(current.token), { width: 220, margin: 1 })
      .then((url) => live && setQr(url))
      .catch((err) => logger.error('[proofQr] qr render failed', err));
    return () => {
      live = false;
    };
  }, [current]);

  const toggle = (id: string): void =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const docs = sent.filter((s) => picked.has(s.doc.id)).map((s) => s.doc);
      const link = await walletProofService.create(transactionId, docs);
      setCurrent(link);
      onCreated(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the proof.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (link: ProofLink): Promise<void> => {
    try {
      await walletProofService.revoke(link);
      onRevoked(link);
      if (current?.id === link.id) setCurrent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke.');
    }
  };

  const copy = async (): Promise<void> => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(walletProofService.proofUrlFor(current.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copy failed — long-press the link instead.');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <QrCode className="h-4 w-4" /> Show a proof
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Someone scanning this sees that you hold each ticked document and that its fingerprint is anchored on-chain —
        never the document, your name or the address. Lasts {PROOF_TTL_HOURS} hours; revoke any time.
      </p>

      {!current ? (
        <>
          <ul className="space-y-1">
            {sent.map((s) => (
              <li key={s.doc.id}>
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={picked.has(s.doc.id)} onChange={() => toggle(s.doc.id)} />
                  {s.doc.label ?? slotDisplayLabel(s.doc.slotId, principal)}
                  <span className="text-muted-foreground">· {slotDisplayLabel(s.doc.slotId, principal)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || picked.size === 0}
            className="mt-3 rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? 'Checking anchors…' : 'Generate QR'}
          </button>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="text-center">
            {qr ? (
              <img src={qr} alt="Proof QR code" className="mx-auto h-[220px] w-[220px] rounded-lg border border-border bg-white p-2" />
            ) : (
              <div className="mx-auto h-[220px] w-[220px] rounded-lg border border-border bg-white" />
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Expires {fmt(current.expiresAt)}</p>
          </div>
          <div className="space-y-2 text-xs">
            <p className="break-all font-mono text-[11px] text-muted-foreground">{walletProofService.proofUrlFor(current.token)}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => void copy()} className="font-medium text-blue-600 hover:text-blue-800">
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button type="button" onClick={() => void revoke(current)} className="font-medium text-red-600 hover:text-red-800">
                Revoke now
              </button>
              <button type="button" onClick={() => setCurrent(null)} className="text-muted-foreground hover:text-foreground">
                New proof
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {active.length > 0 && (
        <div className="mt-4 border-t border-dashed border-border pt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active proofs</p>
          <ul className="space-y-1">
            {active.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground">
                  {l.items.length} {l.items.length === 1 ? 'document' : 'documents'} · {l.viewCount} {l.viewCount === 1 ? 'view' : 'views'} · expires {fmt(l.expiresAt)}
                </span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCurrent(l)} className="text-blue-600 hover:text-blue-800">Show</button>
                  <button type="button" onClick={() => void revoke(l)} className="text-red-600 hover:text-red-800">Revoke</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
