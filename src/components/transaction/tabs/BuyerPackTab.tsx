// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Buyer Pack — the buyer-side mirror of the Sales Pack (monorepo spec
 * docs/plans/2026-09-05-buyer-pack-spec.md). The buyer assembles it here;
 * every other joined party sees the read-only status. Documents behind the
 * ticks are shared only through the Transaction Wallet switches.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { type BuyerPackItem, loadBuyerPack, syncBuyerPack } from '@/services/buyerPack.service';
import { myPartyOn, type MyParty } from '@/services/enquiries.service';
import type { TransactionTabProps } from './transactionTabs.config';
import { BuyerPackItemRow } from './buyerPack/BuyerPackItemRow';
import { PROOF_OF_FUNDS_SLOTS } from './buyerPack/buyerPackLabels';
import { ChainDeclaration } from './buyerPack/ChainDeclaration';
import { MortgageDeclaration } from './buyerPack/MortgageDeclaration';
import { SendToSlot } from './buyerPack/SendToSlot';
import { SurveyDeclaration } from './buyerPack/SurveyDeclaration';

type View =
  | { kind: 'loading' }
  | { kind: 'not_party' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; party: MyParty; items: BuyerPackItem[] };

export function BuyerPackTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (isLive: () => boolean) => {
    try {
      const party = await myPartyOn(transactionId);
      if (!isLive()) return;
      if (!party) { setView({ kind: 'not_party' }); return; }
      // The buyer's open settles anything pending on the trail; others just read.
      const items = party.role === 'buyer' ? await syncBuyerPack(transactionId) : await loadBuyerPack(transactionId);
      if (isLive()) setView({ kind: 'ready', party, items });
    } catch (e) {
      if (isLive()) setView({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load the buyer pack' });
    }
  }, [transactionId]);

  useEffect(() => {
    let live = true;
    void load(() => live);
    return () => { live = false; };
  }, [load]);

  const update = (items: BuyerPackItem[]): void => setView((v) => (v.kind === 'ready' ? { ...v, items } : v));
  // A failed sync leaves the pack stale, so say so rather than pretend.
  const resync = (): void => {
    setNotice(null);
    syncBuyerPack(transactionId).then(update).catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'Could not refresh the pack'));
  };

  if (view.kind === 'loading') return <p className="text-sm text-muted-foreground">Loading the buyer pack…</p>;
  if (view.kind === 'not_party') return <p className="text-sm text-muted-foreground">You are not a party on this transaction, so there is no buyer pack to show.</p>;
  if (view.kind === 'error') return <p role="alert" className="text-sm text-destructive">{view.message}</p>;

  const { party, items } = view;
  const isBuyer = party.role === 'buyer';
  const ready = items.filter((i) => i.status === 'ready').length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Buyer pack</h2>
          <span className="ml-auto text-sm font-semibold text-teal-700 dark:text-teal-300">{ready} of {items.length} ready</span>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {isBuyer
            ? 'What the seller’s side will ask before they commit: who you are, how you are paying, whether you are in a chain, and where the survey is. Each tick is hashed onto the audit trail.'
            : 'The buyer’s readiness, as declared and evidenced by them. Documents behind these ticks are shared only through the Transaction Wallet switches.'}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={ready}
          aria-label="Buyer pack readiness"
          className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
        >
          <div className="h-full rounded-full bg-teal-500 transition-[width]" style={{ width: `${items.length ? (ready / items.length) * 100 : 0}%` }} />
        </div>
        {notice && <p role="alert" className="mt-3 text-sm text-destructive">{notice}</p>}
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-slate-700/40">
          {items.map((item) => (
            <BuyerPackItemRow key={item.item} item={item} showHelp={isBuyer}>
              {isBuyer && item.item === 'id_aml' && item.status !== 'ready' && (
                <Link to={{ search: '?tab=aml' }} className="text-sm text-teal-700 underline dark:text-teal-300">Open ID & AML</Link>
              )}
              {isBuyer && item.item === 'proof_of_funds' && item.status !== 'ready' && (
                <SendToSlot transactionId={transactionId} slots={PROOF_OF_FUNDS_SLOTS} onSent={resync} />
              )}
              {isBuyer && item.item === 'mortgage' && (
                <MortgageDeclaration transactionId={transactionId} detail={item.detail} onUpdated={update} />
              )}
              {isBuyer && item.item === 'chain' && (
                <ChainDeclaration transactionId={transactionId} detail={item.detail} onUpdated={update} />
              )}
              {isBuyer && item.item === 'survey' && (
                <SurveyDeclaration transactionId={transactionId} detail={item.detail} onUpdated={update} />
              )}
            </BuyerPackItemRow>
          ))}
        </ul>
        {items.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Nothing to show yet.</p>
        )}
      </div>
    </div>
  );
}

export default BuyerPackTab;
