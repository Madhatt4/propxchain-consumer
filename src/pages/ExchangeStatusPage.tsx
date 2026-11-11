// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Exchange status, read-only, for the buyer or seller (card 6c8f1dca).
 *
 * This page replaced an exchange "signing" page that made confirmation codes
 * in the browser and showed funds-holding steps PropXchain does not run.
 * PropXchain never holds or moves money, and the real exchange is recorded by
 * the conveyancers in PropXchain Pro, so the client only reads the record.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { icpService } from '@/services/icp.service';
import { logger } from '@/utils/logger';
import { conveyancerRecordRows, useConveyancerRecords, type RecordRow } from '@/hooks/useConveyancerRecords';
import {
  completionDateText,
  confirmationText,
  exchangeText,
  toExchangeStatus,
  type ExchangeRecordInput,
  type ExchangeStatus,
} from '@/lib/exchangeStatus';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; status: ExchangeStatus };

const MUTED = 'text-sm text-gray-600 dark:text-slate-300';

async function loadExchange(transactionId: string): Promise<ExchangeStatus | null> {
  await icpService.initialize();
  const tx = await icpService.getTransactionByTextId(transactionId);
  return tx ? toExchangeStatus(tx as ExchangeRecordInput) : null;
}

function useExchangeStatus(transactionId: string): LoadState {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  useEffect(() => {
    let isCancelled = false;
    setState({ kind: 'loading' });
    loadExchange(transactionId)
      .then((status) => {
        if (!isCancelled) setState(status ? { kind: 'ready', status } : { kind: 'missing' });
      })
      .catch((err: unknown) => {
        logger.error('Could not load exchange status', err);
        if (!isCancelled) setState({ kind: 'missing' });
      });
    return () => { isCancelled = true; };
  }, [transactionId]);
  return state;
}

function Row({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-3 border-t border-gray-200 dark:border-slate-700 first:border-t-0 sm:grid-cols-[16rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</dt>
      <dd className={MUTED}>{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 pb-2 border-b border-gray-300 dark:border-slate-600">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExchangeRecord({ status, recordRows }: { status: ExchangeStatus; recordRows: RecordRow[] }): ReactNode {
  return (
    <Section title="Exchange record">
      <dl className="flex flex-col">
        <Row label="Contracts" value={exchangeText(status)} />
        <Row label="Agreed completion date" value={completionDateText(status)} />
        <Row label="Buyer's conveyancer: exchange confirmed" value={confirmationText(status.buyerConveyancerConfirmed)} />
        <Row label="Seller's conveyancer: exchange confirmed" value={confirmationText(status.sellerConveyancerConfirmed)} />
        {recordRows.map((row) => <Row key={row.label} label={row.label} value={row.value} />)}
        <Row label="Deal stage" value={status.statusLabel} />
      </dl>
    </Section>
  );
}

function HowExchangeWorks({ isExchanged }: { isExchanged: boolean }): ReactNode {
  return (
    <Section title="How exchange works">
      <div className="flex flex-col gap-3 pt-3">
        <p className={MUTED}>
          {isExchanged
            ? 'Both conveyancers have confirmed exchange. The sale is now legally binding on both sides, and the next step is completion on the agreed date.'
            : 'Your conveyancers handle exchange. When they are both ready, each confirms it on PropXchain, and this page updates. There is nothing for you to sign here.'}
        </p>
        <p className={MUTED}>
          PropXchain does not hold or move any money. Your funds, including any deposit, go through your
          conveyancer&apos;s client account, and the conveyancers transfer money between themselves.
        </p>
        <p className={MUTED}>
          Before you send any money, confirm your conveyancer&apos;s bank details with them by phone. Never rely on
          bank details sent by email alone.
        </p>
      </div>
    </Section>
  );
}

export default function ExchangeStatusPage(): ReactNode {
  const { transactionId = '' } = useParams<{ transactionId: string }>();
  const state = useExchangeStatus(transactionId);
  const recordRows = conveyancerRecordRows(useConveyancerRecords(transactionId));
  const dealHref = `/transaction/${encodeURIComponent(transactionId)}/flow`;

  return (
    <main className="min-h-screen bg-white dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to={dealHref} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
          Back to the deal
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100 font-['Fraunces',serif]">
          Exchange of contracts
        </h1>
        {state.kind === 'loading' && <p className={`mt-4 ${MUTED}`}>Loading the exchange record…</p>}
        {state.kind === 'missing' && (
          <p className={`mt-4 ${MUTED}`}>
            We could not find this deal, or you are not a party to it.{' '}
            <Link to="/dashboard" className="text-teal-700 dark:text-teal-400 hover:underline">Return to your dashboard</Link>.
          </p>
        )}
        {state.kind === 'ready' && (
          <>
            {state.status.propertyAddress && <p className={`mt-1 ${MUTED}`}>{state.status.propertyAddress}</p>}
            <ExchangeRecord status={state.status} recordRows={recordRows} />
            <HowExchangeWorks isExchanged={state.status.isExchanged} />
          </>
        )}
      </div>
    </main>
  );
}
