// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, Loader2, FileText, Fingerprint, Link2, AlertTriangle, Wallet } from 'lucide-react';
import {
  getPresentationRequest,
  verifyPresented,
  walletVcMode,
  type VerifyResult,
} from '@/services/walletVc.service';
import type { TransactionTabProps } from './transactionTabs.config';

/** Friendly labels for the OpenID4VP claim keys. */
const CLAIM_LABELS: Record<string, string> = {
  lender: 'Lender name',
  offerReference: 'Offer reference',
  propertyAddress: 'Property address',
  offerAmountPence: 'Offer amount',
};

/** The credentials this transaction can hold. Only the mortgage offer is wired in slice 1. */
const CREDENTIALS = [
  { key: 'offer', Icon: FileText, name: 'Mortgage offer', detail: 'Issuer: Halifax · presented from the buyer’s wallet' },
  { key: 'aml', Icon: ShieldCheck, name: 'AML + Source of Funds', detail: 'Coming next · selective disclosure (SD-JWT)' },
  { key: 'id', Icon: Fingerprint, name: 'Identity', detail: 'DIATF-certified IDSP' },
] as const;

function StatusChip({ kind }: { kind: 'verified' | 'idle' }): JSX.Element {
  return kind === 'verified' ? (
    <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ Verified</span>
  ) : (
    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Not requested</span>
  );
}

/** Wallet (VC) tab — request a credential from the holder's wallet, verify it, record proof-of-use. */
export function WalletVcTab({ transactionId }: TransactionTabProps): JSX.Element {
  const mode = walletVcMode();
  const [qr, setQr] = useState<string>('');
  const [requested, setRequested] = useState<string[]>([]);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'unavailable') return;
    let active = true;
    (async () => {
      try {
        const req = await getPresentationRequest(transactionId);
        if (!active) return;
        setRequested(req.requestedClaims);
        setQr(await QRCode.toDataURL(req.request, { margin: 1, width: 160 }));
        const r = await verifyPresented(transactionId, 'SAMPLE');
        if (active) setResult(r);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
    return () => { active = false; };
  }, [transactionId, mode]);

  // Prod / no verifier configured — never show sample data.
  if (mode === 'unavailable') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
        <Wallet className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Credential verification isn’t available yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Once a verifier is connected, parties will be able to share verifiable credentials from
          their own wallet and have them checked against the trust framework here.
        </p>
      </div>
    );
  }

  if (error) return <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Couldn’t load: {error}</p>;
  if (!result) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const verified = result.verified;

  return (
    <div className="space-y-6">
      {/* Credentials for this transaction */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credentials for this transaction</h3>
        <div className="space-y-2">
          {CREDENTIALS.map(({ key, Icon, name, detail }) => (
            <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              <StatusChip kind={key === 'offer' && verified ? 'verified' : 'idle'} />
            </div>
          ))}
        </div>
      </section>

      {/* Request & verify */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mortgage offer — request &amp; verify</h3>
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="font-semibold text-foreground">Request from wallet</p>
            <p className="mb-3 text-xs text-muted-foreground">OpenID4VP · buyer scans to share</p>
            {qr && <img src={qr} alt="presentation request" className="mx-auto h-40 w-40 rounded-lg border border-border bg-white p-2" />}
            <p className="mt-2 text-center text-xs font-medium text-muted-foreground">Scan to share your mortgage offer</p>
            <div className="mt-3 border-t border-dashed border-border pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">We’re asking to view</p>
              <ul className="space-y-1 text-xs">
                {requested.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-foreground"><span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span> {CLAIM_LABELS[c] ?? c}</li>
                ))}
                <li className="flex items-center gap-2 text-muted-foreground"><span className="font-bold text-muted-foreground">✗</span> Date of birth</li>
              </ul>
            </div>
          </div>

          <div className={`rounded-xl border p-5 ${verified ? 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/40 dark:bg-emerald-900/20' : 'border-red-200 dark:border-red-700/50 bg-red-50/40 dark:bg-red-900/20'}`}>
            {verified ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">Verified</span>
                  {result.provenance && (
                    <span className="ml-auto rounded-full border border-emerald-200 dark:border-emerald-700/50 bg-white dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                      ✓ {result.provenance.alg} signed
                    </span>
                  )}
                </div>
                <ul className="mb-4 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                  <li>✓ Signature &amp; claims valid</li>
                  <li>✓ Issuer registered · Raidiam</li>
                  <li>✓ Authorised · active · key valid</li>
                  <li>✓ Not revoked · status list</li>
                </ul>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Lender</span><br /><b className="text-foreground">{String(result.claims?.lender)}</b></p>
                  <p><span className="text-muted-foreground">Offer reference</span><br /><b className="text-foreground">{String(result.claims?.offerReference)}</b></p>
                  <p><span className="text-muted-foreground">Property</span><br /><b className="text-foreground">{String(result.claims?.propertyAddress)}</b></p>
                  <p><span className="text-muted-foreground">Offer amount</span><br /><b className="text-foreground">£{(Number(result.claims?.offerAmountPence) / 100).toLocaleString('en-GB')}</b></p>
                </div>
              </>
            ) : (
              <p className="font-semibold text-red-600 dark:text-red-400">Rejected — {result.reason}</p>
            )}
          </div>
        </div>
      </section>

      {/* On-chain proof-of-use (pending until Phase C wires the canister write) */}
      {verified && (
        <section className="rounded-xl bg-gray-900 p-5 text-gray-300">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-teal-300" />
            <span className="font-semibold text-white">On-chain proof-of-use</span>
            <span className="ml-auto rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">Pending · records on live verification</span>
          </div>
          <dl className="space-y-1 font-mono text-xs">
            <div className="flex gap-3 border-b border-gray-800 py-1"><dt className="min-w-[130px] text-gray-500">artefactHash</dt><dd className="text-gray-500">— (written when verified live)</dd></div>
            <div className="flex gap-3 border-b border-gray-800 py-1"><dt className="min-w-[130px] text-gray-500">credentialType</dt><dd className="text-gray-200">{result.credentialType}</dd></div>
            <div className="flex gap-3 border-b border-gray-800 py-1"><dt className="min-w-[130px] text-gray-500">issuer</dt><dd className="text-gray-200">{result.issuer}</dd></div>
            <div className="flex gap-3 py-1"><dt className="min-w-[130px] text-gray-500">claimsPresented</dt><dd className="text-gray-200">{requested.join(', ')}</dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-gray-500">Hash + metadata only — no PII. The credential stays off-chain in the holder’s wallet.</p>
        </section>
      )}

      {/* Rejected-states explainer */}
      <div className="flex gap-2 rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p><b>Rejected states (same flow):</b> a tampered credential → ✗ signature; a revoked one → ✗ status list; an unknown issuer → ✗ not resolvable at the trust registry. Each shows the reason — nothing is ingested or recorded.</p>
      </div>
    </div>
  );
}
