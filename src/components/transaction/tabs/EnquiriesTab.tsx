// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Enquiries tab — the structured pre-contract enquiries loop for one deal.
 * Loads the caller's party row (to show the right controls) and the rows this
 * party may read under RLS. Writes all go through enquiries.service, which
 * calls the monorepo-owned edge functions; the server enforces every rule.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { listEnquiries, myPartyOn, type Enquiry, type MyParty } from '@/services/enquiries.service';
import type { TransactionTabProps } from './transactionTabs.config';
import { EnquiryComposer } from './enquiries/EnquiryComposer';
import { EnquiryDetail } from './enquiries/EnquiryDetail';
import { EnquiryUpload } from './enquiries/EnquiryUpload';
import { STATUS_CLASS, categoryLabel, statusLabel, statusTone } from './enquiries/enquiryLabels';

type View = { kind: 'loading' } | { kind: 'not_party' } | { kind: 'error'; message: string } | { kind: 'ready'; party: MyParty; rows: Enquiry[] };

export function EnquiriesTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async (isLive: () => boolean) => {
    try {
      const party = await myPartyOn(transactionId);
      if (!isLive()) return;
      if (!party) { setView({ kind: 'not_party' }); return; }
      const rows = await listEnquiries(transactionId);
      if (isLive()) setView({ kind: 'ready', party, rows });
    } catch (e) {
      if (isLive()) setView({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load enquiries' });
    }
  }, [transactionId]);
  useEffect(() => {
    let live = true;
    void load(() => live);
    return () => { live = false; };
  }, [load]);

  const upsert = (row: Enquiry) => setView((v) => (v.kind === 'ready'
    ? { ...v, rows: v.rows.some((r) => r.id === row.id) ? v.rows.map((r) => (r.id === row.id ? row : r)) : [...v.rows, row] }
    : v));

  if (view.kind === 'loading') return <p className="text-sm text-muted-foreground">Loading enquiries…</p>;
  if (view.kind === 'not_party') return <p className="text-sm text-muted-foreground">You are not a party on this transaction, so there are no enquiries to show.</p>;
  if (view.kind === 'error') return <p role="alert" className="text-sm text-destructive">{view.message}</p>;

  const { party, rows } = view;
  const isConv = party.role === 'conveyancer' && party.side !== null;
  const current = rows.find((r) => r.id === selected) ?? null;
  const open = rows.filter((r) => r.status === 'draft' || r.status === 'raised' || r.status === 'answered');
  const done = rows.filter((r) => r.status === 'closed' || r.status === 'withdrawn');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Pre-contract enquiries</h3>
          <p className="text-sm text-muted-foreground">{open.length} open · {done.length} closed. Every raise, answer and close is hashed onto the audit trail.</p>
        </div>
        {isConv && <Button type="button" variant="outline" size="sm" onClick={() => setShowUpload((s) => !s)}>{showUpload ? 'Hide PDF upload' : 'Upload a PDF of enquiries'}</Button>}
      </div>
      {isConv && showUpload && <EnquiryUpload transactionId={transactionId} onRaised={upsert} />}
      {isConv && <EnquiryComposer transactionId={transactionId} onRaised={upsert} />}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No enquiries yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {[...open, ...done].map((r) => (
            <li key={r.id}>
              <button type="button" className={`flex w-full items-start gap-3 p-3 text-left hover:bg-muted/40 ${selected === r.id ? 'bg-muted/40' : ''}`} onClick={() => setSelected(selected === r.id ? null : r.id)}>
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[statusTone(r.status)]}`}>{statusLabel(r.status)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.question}</span>
                  <span className="block text-xs text-muted-foreground">{categoryLabel(r.category)}{r.ledger_pending ? ' · ' : ''}{r.ledger_pending && <span className="text-amber-800">Not yet on the audit trail</span>}</span>
                </span>
              </button>
              {current?.id === r.id && <div className="p-3 pt-0"><EnquiryDetail enquiry={current} party={party} onChanged={upsert} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
