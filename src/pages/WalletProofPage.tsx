// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * WalletProofPage — the public proof-only view a wallet QR resolves to
 * (wallet spec 2026-08-18, decision 4). Shows, for each document the owner
 * chose: the document type, that its SHA-256 hash is anchored on the Internet
 * Computer (proof id + date), and when PropXchain last checked that anchor.
 * No name, no address, no filename, no file. Unknown, expired and revoked
 * tokens all render the same "not available" state.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck, ShieldOff } from 'lucide-react';
import { walletProofService, type PublicProof } from '@/services/walletProof.service';

const fmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function WalletProofPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [proof, setProof] = useState<PublicProof | null>(null);

  useEffect(() => {
    // Proof links are private by intent — keep them out of search indexes.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = token ? await walletProofService.fetchPublic(token) : null;
      if (!active) return;
      if (!result) {
        setState('missing');
        return;
      }
      setProof(result);
      setState('ready');
    })();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-teal-600" />
          <h1 className="text-lg font-bold text-foreground">PropXchain document proof</h1>
        </div>

        {state === 'loading' && <p className="text-sm text-muted-foreground">Checking…</p>}

        {state === 'missing' && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <ShieldOff className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">This proof isn’t available</p>
            <p className="mt-1 text-xs text-muted-foreground">
              It may have expired, been withdrawn by its owner, or the link is wrong. Ask them to show you a fresh one.
            </p>
          </div>
        )}

        {state === 'ready' && proof && (
          <>
            <p className="text-sm text-muted-foreground">
              The person showing you this holds the documents below. Each one’s fingerprint (SHA-256) is anchored on the
              Internet Computer blockchain — you’re seeing that it exists and hasn’t changed, not the document itself.
            </p>
            <ul className="space-y-2">
              {proof.items.map((item, i) => (
                <li key={`${item.blockchainId}-${i}`} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.slotLabel}</p>
                    {item.verifiedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Anchored
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Unverified</span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Fingerprint</dt>
                      <dd className="font-mono text-foreground">{item.hashPrefix}…</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">On-chain proof</dt>
                      <dd className="font-mono text-foreground">#{item.blockchainId}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Anchored</dt>
                      <dd className="text-foreground">{fmt(item.anchoredAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Checked by PropXchain</dt>
                      <dd className="text-foreground">{fmt(item.verifiedAt)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Generated {fmt(proof.generatedAt)} · expires {fmt(proof.expiresAt)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
