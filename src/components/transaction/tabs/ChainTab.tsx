// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Link2Off, Link2 } from 'lucide-react';
import { getChain, type ChainResult, type ChainProperty, type PropertyChain } from '@/services/chainService';
import { isChainUnlocked } from '@/services/chainEntitlement.service';
import { ChainUnlockButton } from '@/components/transaction/ChainUnlockButton';
import { icpService } from '@/services/icp.service';
import { useChainGrantPoll } from '@/hooks/useChainGrantPoll';
import { logger } from '@/utils/logger';
import type { TransactionTabProps } from './transactionTabs.config';

interface Stage { key: string; label: string; match: string[]; mortgage?: boolean }
const STAGES: Stage[] = [
  { key: 'sstc', label: 'Sale Agreed', match: ['SSTC'] },
  { key: 'searches_ordered', label: 'Searches Ordered', match: ['Searches Ordered'] },
  { key: 'search_delivered', label: 'Searches Back', match: ['Search Delivered'] },
  { key: 'mortgage_applied', label: 'Mortgage Applied', match: ['Mortgage Applied'], mortgage: true },
  { key: 'mortgage_offer', label: 'Mortgage Offer', match: ['Mortgage Offer'], mortgage: true },
  { key: 'enquiries', label: 'Enquiries', match: ['Enquiries', 'Enquiries Raised'] },
  { key: 'exchange', label: 'Exchanged', match: ['Exchange'] },
  { key: 'completion', label: 'Completed', match: ['Completion', 'Complete'] },
];

const fmt = (d: string): string =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

const title = (s: string): string => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Order properties top→bottom of chain via connection links. */
function orderChain(props: ChainProperty[]): ChainProperty[] {
  const byId = new Map(props.map((p) => [p.id, p]));
  const out: ChainProperty[] = [];
  const seen = new Set<number>();
  let cur = props.filter((p) => p.connections.upwardChain.length === 0).map((p) => p.id);
  cur.forEach((id) => seen.add(id));
  while (cur.length) {
    cur.forEach((id) => { const p = byId.get(id); if (p) out.push(p); });
    const next: number[] = [];
    cur.forEach((id) => (byId.get(id)?.connections.downwardChain ?? []).forEach((c) => {
      if (!seen.has(c)) { seen.add(c); next.push(c); }
    }));
    cur = next;
  }
  // include any orphans not reached
  props.forEach((p) => { if (!seen.has(p.id)) out.push(p); });
  return out;
}

function PropertyRow({ p, isYou }: { p: ChainProperty; isYou: boolean }): JSX.Element {
  const isCash = p.milestones.some((m) => m.label === 'Cash Buyer');
  const done = new Map<string, string>();
  p.milestones.forEach((m) => STAGES.forEach((s) => { if (s.match.includes(m.label)) done.set(s.key, m.date); }));
  let currentKey = '';
  STAGES.forEach((s) => { if (done.has(s.key)) currentKey = s.key; });

  return (
    <div className={`rounded-xl border p-4 ${isYou ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{title(p.displayAddress)}</p>
          {p.tenure && <p className="text-xs text-muted-foreground">{title(p.tenure)}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {isYou && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">YOUR PROPERTY</span>}
          {isCash && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Cash buyer</span>}
        </div>
      </div>
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {STAGES.map((s) => {
          const na = isCash && s.mortgage;
          const state = na ? 'na' : done.has(s.key) ? (s.key === currentKey ? 'current' : 'done') : 'todo';
          const dot = state === 'done' || state === 'current' ? 'bg-emerald-500' : state === 'na' ? 'bg-muted' : 'bg-muted';
          const ring = state === 'current' ? 'ring-4 ring-amber-400/30 bg-amber-500' : '';
          return (
            <div key={s.key} className="min-w-[68px] flex-1 text-center">
              <div className={`mx-auto h-3.5 w-3.5 rounded-full ${ring || dot}`} />
              <p className={`mt-1 text-[10px] leading-tight ${state === 'todo' || state === 'na' ? 'text-muted-foreground' : 'text-foreground'}`}>
                {na ? 'N/A' : s.label}
              </p>
              {done.has(s.key) && <p className="text-[9px] text-muted-foreground">{fmt(done.get(s.key) as string)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The View My Chain tab — chain status with milestone tracking + provenance.
 *
 * Entitlement-gated: `getChain` (a paid VMC proxy call) never fires until
 * `isChainUnlocked` confirms the one-off £25 unlock has been paid for this
 * transaction. This is the cost gate — an unpaid tab must never touch VMC.
 */
export function ChainTab({ transactionId, uprn, propertyAddress }: TransactionTabProps): JSX.Element {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [principalId, setPrincipalId] = useState<string | null>(null);
  const [principalError, setPrincipalError] = useState<string | null>(null);
  const [principalRetryToken, setPrincipalRetryToken] = useState(0);
  const [result, setResult] = useState<ChainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedTransactionId, setCheckedTransactionId] = useState(transactionId);

  const confirmUnlocked = useCallback(() => setUnlocked(true), []);
  const { grantStatus, startPolling, reset: resetGrantPoll } = useChainGrantPoll(transactionId, confirmUnlocked);

  // Reset the gate during render (not inside an effect) when transactionId
  // changes. This is the documented React "adjust state when a prop changes"
  // pattern — it lands in the SAME render pass, before any effects run.
  // Resetting inside a useEffect body instead only *schedules* a future
  // re-render: the getChain effect below shares `transactionId` in its deps,
  // so it fires in the same passive-effect flush as the entitlement effect
  // and would still read the stale `unlocked === true` closure from before
  // the reset took effect — i.e. it would call the paid VMC proxy for a
  // transaction whose payment hasn't been confirmed. Doing the reset here
  // guarantees `unlocked` is already `null` by the time either effect runs.
  if (transactionId !== checkedTransactionId) {
    setCheckedTransactionId(transactionId);
    setUnlocked(null);
    setResult(null);
    setError(null);
    setPrincipalError(null);
    resetGrantPoll();
  }

  useEffect(() => {
    let active = true;
    isChainUnlocked(transactionId).then((u) => { if (active) setUnlocked(u); });
    return () => { active = false; };
  }, [transactionId]);

  // Only needed to drive the Stripe checkout from the teaser, so it's fetched
  // lazily once we know the tab is actually locked (skips the identity call
  // entirely on the common already-paid path).
  useEffect(() => {
    if (unlocked !== false) return;
    let active = true;
    setPrincipalError(null);
    icpService.getUserPrincipal()
      .then((p) => { if (active) setPrincipalId(p); })
      .catch((e: unknown) => {
        logger.warn('Failed to resolve principal for chain unlock', e);
        if (active) setPrincipalError(e instanceof Error ? e.message : 'Could not prepare checkout');
      });
    return () => { active = false; };
  }, [unlocked, principalRetryToken]);

  useEffect(() => {
    if (unlocked !== true) return; // ← no VMC call until paid (£0 gate)
    let active = true;
    getChain({ uprn, address: propertyAddress, transactionId })
      .then((r) => { if (active) setResult(r); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Failed to load chain'); });
    return () => { active = false; };
  }, [unlocked, uprn, propertyAddress, transactionId]);

  const handleUnlocked = startPolling;

  if (unlocked === null) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking access…</div>;
  }

  // Payment confirmed, waiting on the async webhook's on-chain grant to
  // propagate — must never fall through to the teaser (which would show the
  // "pay again" button) or a hard error while this resolves.
  if (grantStatus === 'polling') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Payment confirmed — preparing your chain…</p>
        <p className="max-w-md text-xs text-muted-foreground">This usually takes a few seconds while we finish granting access.</p>
      </div>
    );
  }

  if (grantStatus === 'delayed') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <Link2 className="h-6 w-6 text-primary" />
        <p className="text-sm font-medium text-foreground">Payment confirmed — your chain is still being prepared</p>
        <p className="max-w-md text-xs text-muted-foreground">This is taking a little longer than usual. Refresh in a moment, or check again now.</p>
        <button type="button" onClick={startPolling} className="text-xs font-semibold text-primary underline">Check again</button>
      </div>
    );
  }

  if (unlocked === false) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <Link2 className="h-7 w-7 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">See your live property chain</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Track every link — searches, mortgage, exchange — with live updates from View My Chain for the life of your transaction. One-off unlock, no subscription.
          </p>
        </div>
        {principalId ? (
          <ChainUnlockButton transactionId={transactionId} principalId={principalId} onUnlocked={handleUnlocked} />
        ) : principalError ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <p>Couldn’t prepare checkout: {principalError}</p>
            <button type="button" onClick={() => setPrincipalRetryToken((t) => t + 1)} className="text-xs font-semibold text-primary underline">Try again</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing checkout…</div>
        )}
      </div>
    );
  }

  if (error) return <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Couldn’t load chain status: {error}</p>;
  if (!result) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading chain status…</div>;

  if (result.status === 'not_in_chain' || !result.chain) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <Link2Off className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Not part of a tracked chain yet</p>
        <p className="max-w-md text-xs text-muted-foreground">No connected sale or purchase has been detected for this property in the chain network. We’ll surface the chain here as soon as it appears.</p>
      </div>
    );
  }

  const chain: PropertyChain = result.chain;
  const ordered = orderChain(chain.properties);
  const yourIdx = ordered.findIndex((p) => uprn && String(p.uprn) === String(uprn));
  const youPosition = yourIdx >= 0 ? yourIdx + 1 : null;

  const summary = (
    <div className="mb-4 flex flex-wrap gap-2 text-xs">
      <span className="rounded-full border border-border bg-muted px-3 py-1">Chain: <b className="text-foreground">{title(chain.chainType.replace(/_/g, ' '))}</b></span>
      <span className="rounded-full border border-border bg-muted px-3 py-1">Length: <b className="text-foreground">{chain.chainLength}</b></span>
      {youPosition && <span className="rounded-full border border-border bg-muted px-3 py-1">Your link: <b className="text-foreground">{youPosition} of {chain.chainLength}</b></span>}
    </div>
  );

  return (
    <div>
      {summary}
      <div className="space-y-3">
        {ordered.map((p, i) => (
          <div key={p.id}>
            {i > 0 && <div className="mx-auto my-1 h-4 w-px bg-border" />}
            <PropertyRow p={p} isYou={uprn ? p.uprn === Number(uprn) : i === 0} />
          </div>
        ))}
      </div>
      {result.provenance && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Verified &amp; signed by <b className="text-foreground">View My Chain</b> · {result.provenance.alg} · {new Date(result.provenance.signedAt).toLocaleString('en-GB')}
        </div>
      )}
    </div>
  );
}
