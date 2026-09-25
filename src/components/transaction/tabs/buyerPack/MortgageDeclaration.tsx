// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  type BuyerPackDetail,
  type BuyerPackItem,
  type FundingType,
  declareBuyerPack,
  syncBuyerPack,
} from '@/services/buyerPack.service';
import { MORTGAGE_SLOTS } from './buyerPackLabels';
import { SendToSlot } from './SendToSlot';

interface Props {
  transactionId: string;
  detail: BuyerPackDetail;
  onUpdated: (items: BuyerPackItem[]) => void;
}

export function MortgageDeclaration({ transactionId, detail, onUpdated }: Props): JSX.Element {
  const [fundingType, setFundingType] = useState<FundingType | null>(detail.funding_type ?? null);
  const [lender, setLender] = useState(detail.lender_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    if (!fundingType) return;
    setSaving(true);
    setError(null);
    try {
      onUpdated(await declareBuyerPack(transactionId, {
        fundingType,
        lenderName: fundingType === 'mortgage' ? lender.trim() || null : null,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };
  const resync = (): void => {
    syncBuyerPack(transactionId).then(onUpdated).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not refresh the pack'));
  };

  return (
    <div className="space-y-2 text-sm">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">How are you funding the purchase?</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`funding-${transactionId}`} checked={fundingType === 'cash'} onChange={() => setFundingType('cash')} /> Cash buyer
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={`funding-${transactionId}`} checked={fundingType === 'mortgage'} onChange={() => setFundingType('mortgage')} /> Mortgage
        </label>
      </fieldset>
      {fundingType === 'mortgage' && (
        <label className="block">
          <span className="text-xs text-muted-foreground">Lender</span>
          <input
            type="text"
            value={lender}
            maxLength={80}
            onChange={(e) => setLender(e.target.value)}
            placeholder="e.g. Halifax"
            className="mt-0.5 block w-full max-w-xs rounded-md border bg-background px-2 py-1"
          />
        </label>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={!fundingType || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</Button>
        {error && <span role="alert" className="text-destructive">{error}</span>}
      </div>
      {fundingType === 'mortgage' && (
        <SendToSlot transactionId={transactionId} slots={MORTGAGE_SLOTS} onSent={resync} />
      )}
      {fundingType === 'cash' && (
        <p className="text-xs text-muted-foreground">A cash buyer is ready once proof of funds above is sent.</p>
      )}
    </div>
  );
}
