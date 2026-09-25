// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { type BuyerPackDetail, type BuyerPackItem, type ChainPosition, declareBuyerPack } from '@/services/buyerPack.service';
import { isChainUnlocked } from '@/services/chainEntitlement.service';
import { CHAIN_COPY } from './buyerPackLabels';

interface Props {
  transactionId: string;
  detail: BuyerPackDetail;
  onUpdated: (items: BuyerPackItem[]) => void;
}

const POSITIONS: ChainPosition[] = ['none', 'first_time_buyer', 'selling_linked'];

export function ChainDeclaration({ transactionId, detail, onUpdated }: Props): JSX.Element {
  const [position, setPosition] = useState<ChainPosition | null>(detail.chain_position ?? null);
  const [linked, setLinked] = useState(detail.linked_transaction_id ?? '');
  const [unlocked, setUnlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    isChainUnlocked(transactionId).then((u) => { if (live) setUnlocked(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [transactionId]);

  const save = async (): Promise<void> => {
    if (!position) return;
    setSaving(true);
    setError(null);
    try {
      onUpdated(await declareBuyerPack(transactionId, {
        chainPosition: position,
        linkedTransactionId: position === 'selling_linked' ? linked.trim() || null : null,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 text-sm">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Chain position</legend>
        {POSITIONS.map((p) => (
          <label key={p} className="flex items-center gap-1.5">
            <input type="radio" name={`chain-${transactionId}`} checked={position === p} onChange={() => setPosition(p)} /> {CHAIN_COPY[p]}
          </label>
        ))}
      </fieldset>
      {position === 'selling_linked' && (
        <label className="block">
          <span className="text-xs text-muted-foreground">Linked PropXchain deal (optional)</span>
          <input
            type="text"
            value={linked}
            onChange={(e) => setLinked(e.target.value)}
            placeholder="tx_…"
            className="mt-0.5 block w-full max-w-xs rounded-md border bg-background px-2 py-1"
          />
        </label>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={!position || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</Button>
        {error && <span role="alert" className="text-destructive">{error}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {unlocked
          ? <>The verified chain is in the <Link to={{ search: '?tab=chain' }} className="underline">Chain tab</Link>; this declaration is what the other side sees until then.</>
          : 'Your declaration is what the other side sees. Either party can unlock the verified chain in the Chain tab.'}
      </p>
    </div>
  );
}
