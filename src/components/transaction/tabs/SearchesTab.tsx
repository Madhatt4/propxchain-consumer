// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Searches tab — the deal's search orders, whether each one's results are
 * back, and the buyer-side sign-off underneath. Any party on the deal can
 * read it (the server refuses anyone else).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SearchSignOffCard } from '@/components/searches/SearchSignOffCard';
import {
  getDealSearchOrders,
  getMySignOffRole,
  getSignOffs,
  revokeSignOff,
  signOffSearches,
  type DealSearchOrder,
  type SearchSignOffRecord,
  type SignOffRole,
} from '@/services/searchSignOff.service';
import type { TransactionTabProps } from './transactionTabs.config';

const PROVIDER_LABEL: Record<string, string> = {
  onesearch: 'OneSearch',
  groundsure: 'Groundsure',
  tmgroup: 'tmGroup',
  council_direct: 'Council (direct)',
  landmark: 'Landmark',
};

interface Loaded {
  orders: DealSearchOrder[];
  signOffs: SearchSignOffRecord[];
  myRole: SignOffRole | null;
  myUserId: string | null;
}

type View = { kind: 'loading' } | { kind: 'error'; message: string } | ({ kind: 'ready' } & Loaded);

async function loadAll(transactionId: string): Promise<Loaded> {
  const [orders, signOffs, myRole, user] = await Promise.all([
    getDealSearchOrders(transactionId),
    getSignOffs(transactionId),
    getMySignOffRole(transactionId),
    supabase.auth.getUser(),
  ]);
  return { orders, signOffs, myRole, myUserId: user.data.user?.id ?? null };
}

export function SearchesTab({ transactionId }: TransactionTabProps): JSX.Element {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const load = useCallback(async (isLive: () => boolean) => {
    try {
      const loaded = await loadAll(transactionId);
      if (isLive()) setView({ kind: 'ready', ...loaded });
    } catch (e) {
      if (isLive()) setView({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load searches' });
    }
  }, [transactionId]);

  useEffect(() => {
    let live = true;
    void load(() => live);
    return () => { live = false; };
  }, [load]);

  const reload = (): Promise<void> => load(() => true);

  if (view.kind === 'loading') return <p className="text-sm text-muted-foreground">Loading searches…</p>;
  if (view.kind === 'error') return <p role="alert" className="text-sm text-destructive">{view.message}</p>;

  const resultsBack = view.orders.filter((o) => o.hasResults).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Searches</h3>
        <p className="text-sm text-muted-foreground">
          {view.orders.length === 0
            ? 'No searches have been ordered on this deal yet.'
            : `${resultsBack} of ${view.orders.length} back. Sign-offs are hashed onto the audit trail.`}
        </p>
      </div>
      {view.orders.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {view.orders.map((o) => (
            <li key={o.searchOrderId} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block">{PROVIDER_LABEL[o.provider] ?? o.provider}</span>
                <span className="block text-xs text-muted-foreground">
                  Ordered {new Date(o.orderedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${o.hasResults ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {o.hasResults ? 'Results back' : 'Awaiting results'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <SearchSignOffCard
        signOffs={view.signOffs}
        myRole={view.myRole}
        myUserId={view.myUserId}
        resultsBack={resultsBack}
        onSignOff={async (notes) => { await signOffSearches(transactionId, notes); await reload(); }}
        onRevoke={async (id, reason) => { await revokeSignOff(transactionId, id, reason); await reload(); }}
      />
    </div>
  );
}
