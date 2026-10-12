// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Mortgage / Funding stage: writes the Buyer Pack, nothing else (monorepo
 * spec docs/plans/2026-09-05-buyer-pack-spec.md, decision 4). The funding
 * type and lender are a declaration; the decision in principle, offer or
 * proof of funds are sent from the PropXchain Wallet. No amounts are
 * collected (decision 3) and nothing is kept in the browser: the stage
 * reads the same server-computed status the other side sees.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { StageConfig } from '../../../../types/stage.types';
import {
  type BuyerPackItem,
  type FundingType,
  declareBuyerPack,
  loadBuyerPack,
  readOfferExpiry,
  syncBuyerPack,
} from '../../../../services/buyerPack.service';
import { lenderPanelService } from '../../../../services/lenderPanel.service';
import { logger } from '../../../../utils/logger';
import { MORTGAGE_SLOTS, PROOF_OF_FUNDS_SLOTS, describeItem } from '../../tabs/buyerPack/buyerPackLabels';
import { SendToSlot } from '../../tabs/buyerPack/SendToSlot';

/** Sentinel select value for "lender not in the list", which swaps in the free-text input. */
const OTHER_LENDER = '__other__';

interface StageProps {
  stage: StageConfig;
  onComplete?: (stageId: string) => void;
  transactionId?: string;
  /** Completed stage re-opened via the Edit pencil: render the form, not the summary. */
  isEditing?: boolean;
  onCancelEdit?: () => void;
  onAfterEdit?: () => void;
}

const mortgageItem = (pack: BuyerPackItem[] | null): BuyerPackItem | undefined => pack?.find((i) => i.item === 'mortgage');

const OFFER_READ_NOTES: Record<string, string> = {
  no_date_found: "We couldn't find the expiry date in your offer. Please type it in.",
  not_a_pdf: 'We can only read a PDF offer. Please type the expiry date in.',
  unreadable: "We couldn't read your offer. Please type the expiry date in.",
  no_offer_sent: 'Send your mortgage offer from your wallet first, or type the date in.',
};

interface OfferExpiryFieldProps {
  transactionId: string;
  value: string;
  onChange: (v: string) => void;
}

/**
 * When the offer runs out. Read from the sent offer once (the buyer-pack
 * function reads it in code; nothing leaves the server) and always shown for
 * the buyer to check before they save: the date they confirm is what every
 * party on the deal is warned by.
 */
function OfferExpiryField({ transactionId, value, onChange }: OfferExpiryFieldProps): ReactNode {
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const read = (): void => {
    setReading(true);
    setNote(null);
    readOfferExpiry(transactionId)
      .then((r) => {
        if (r.expiresOn !== null) { onChange(r.expiresOn); setNote('Read from your offer. Check it matches before you save.'); }
        else setNote(OFFER_READ_NOTES[r.reason] ?? OFFER_READ_NOTES.unreadable);
      })
      .catch((err: unknown) => { logger.warn('[funding] offer read failed', err); setNote(OFFER_READ_NOTES.unreadable); })
      .finally(() => setReading(false));
  };

  // Read once, only when there is nothing saved to overwrite.
  useEffect(() => {
    if (tried || value) return;
    setTried(true);
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried, value]);

  return (
    <div>
      <label htmlFor="offer-expiry" className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
        When does your mortgage offer expire? <span className="font-normal text-gray-400">(everyone on the deal is warned a month before)</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id="offer-expiry"
          type="date"
          value={value}
          onChange={(e) => { onChange(e.target.value); setNote(null); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
        />
        <button type="button" onClick={read} disabled={reading} className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-300">
          {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Read it from my offer'}
        </button>
      </div>
      {note && <p data-testid="offer-expiry-note" className="mt-1 text-xs text-gray-500 dark:text-slate-400">{note}</p>}
    </div>
  );
}

interface LenderPickerProps {
  lenders: string[];
  loaded: boolean;
  value: string;
  onChange: (v: string) => void;
}

function LenderPicker({ lenders, loaded, value, onChange }: LenderPickerProps): ReactNode {
  const [other, setOther] = useState(false);
  // A saved name the LOADED list does not know is an "Other" lender; before
  // the list arrives, [] would flag every saved name, so wait for it.
  const showOther = other || (value !== '' && loaded && !lenders.includes(value));
  const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100';
  return (
    <div>
      <label htmlFor="lender-select" className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
        Who is your mortgage lender? <span className="font-normal text-gray-400">(helps us show conveyancers on their panel)</span>
      </label>
      <select
        id="lender-select"
        value={showOther ? OTHER_LENDER : value}
        onChange={(e) => {
          if (e.target.value === OTHER_LENDER) { setOther(true); onChange(''); }
          else { setOther(false); onChange(e.target.value); }
        }}
        className={inputClass}
      >
        <option value="">Select your lender (optional)</option>
        {lenders.map((l) => <option key={l} value={l}>{l}</option>)}
        <option value={OTHER_LENDER}>Other / not listed</option>
      </select>
      {showOther && (
        <input type="text" value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} placeholder="Lender name" className={`mt-2 ${inputClass}`} />
      )}
    </div>
  );
}

export function MortgageFundingStage({ stage, onComplete, transactionId, isEditing = false, onCancelEdit, onAfterEdit }: StageProps): ReactNode {
  const [pack, setPack] = useState<BuyerPackItem[] | null>(null);
  const [fundingType, setFundingType] = useState<FundingType | null>(null);
  const [lenderName, setLenderName] = useState('');
  const [offerExpiresOn, setOfferExpiresOn] = useState('');
  const [lenders, setLenders] = useState<string[]>([]);
  const [lendersLoaded, setLendersLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lenderPanelService.getLenders()
      .then((list) => { setLenders(list); setLendersLoaded(true); })
      .catch((err: unknown) => logger.warn('[funding] lender list failed to load', err));
  }, []);

  // The pack is the source of truth; re-read when edit mode toggles so the
  // pencil re-opens the form with what the server holds.
  useEffect(() => {
    if (!transactionId) return;
    let live = true;
    loadBuyerPack(transactionId)
      .then((items) => {
        if (!live) return;
        setPack(items);
        const d = mortgageItem(items)?.detail;
        setFundingType(d?.funding_type ?? null);
        setLenderName(d?.lender_name ?? '');
        setOfferExpiresOn(d?.offer_expires_on ?? '');
      })
      .catch((err: unknown) => { if (live) setError(err instanceof Error ? err.message : 'Could not read your funding position'); });
    return () => { live = false; };
  }, [transactionId, isEditing]);

  const refresh = (items: BuyerPackItem[]): void => { setPack(items); setError(null); };
  const resync = (): void => {
    if (!transactionId) return;
    syncBuyerPack(transactionId).then(refresh).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not refresh'));
  };

  const item = mortgageItem(pack);
  const offerSent = fundingType === 'mortgage' && item?.detail.mortgage_stage === 'offer';
  const declaredMatches = !!item && item.detail.funding_type === fundingType && (item.detail.lender_name ?? '') === lenderName.trim()
    && (!offerSent || (item.detail.offer_expires_on ?? '') === offerExpiresOn);
  const canComplete = !!fundingType && !!item && item.status === 'ready' && declaredMatches;

  const declare = async (): Promise<BuyerPackItem[] | null> => {
    if (!transactionId || !fundingType) return null;
    setSaving(true);
    setError(null);
    try {
      const items = await declareBuyerPack(transactionId, {
        fundingType,
        lenderName: fundingType === 'mortgage' ? lenderName.trim() || null : null,
        ...(offerSent ? { mortgageOfferExpiresOn: offerExpiresOn || null } : {}),
      });
      refresh(items);
      return items;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    const items = await declare();
    if (items && mortgageItem(items)?.status === 'ready') onComplete?.(stage.id);
  };
  const handleSaveEdit = async (): Promise<void> => {
    if (await declare()) { onAfterEdit?.(); onCancelEdit?.(); }
  };

  if (stage.status === 'completed' && !isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Funding confirmed
        </div>
        {item && <p className="pl-6 text-xs text-gray-500 dark:text-slate-400">{describeItem(item)}</p>}
      </div>
    );
  }

  const typeButton = (type: FundingType, label: string): ReactNode => (
    <button
      key={type}
      type="button"
      onClick={() => setFundingType(type)}
      className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
        fundingType === type
          ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
          : 'border-gray-300 text-gray-600 hover:border-teal-400 dark:border-slate-600 dark:text-slate-400'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {isEditing && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-300">
          Editing your funding details. Save changes to update them.
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">How are you funding this purchase?</p>
        <div className="flex gap-2">
          {typeButton('mortgage', 'Mortgage')}
          {typeButton('cash', 'Cash Buyer')}
        </div>
      </div>

      {fundingType === 'mortgage' && (
        <>
          <LenderPicker lenders={lenders} loaded={lendersLoaded} value={lenderName} onChange={setLenderName} />
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">Decision in principle or mortgage offer</p>
            {transactionId && <SendToSlot transactionId={transactionId} slots={MORTGAGE_SLOTS} onSent={resync} />}
          </div>
          {offerSent && transactionId && (
            <OfferExpiryField transactionId={transactionId} value={offerExpiresOn} onChange={setOfferExpiresOn} />
          )}
        </>
      )}
      {fundingType === 'cash' && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">Proof of funds</p>
          {transactionId && <SendToSlot transactionId={transactionId} slots={PROOF_OF_FUNDS_SLOTS} onSent={resync} />}
        </div>
      )}

      {item && fundingType && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {item.status === 'ready' ? `Pack shows: ${describeItem(item)}` : 'The stage completes once the document is sent from your wallet.'}
        </p>
      )}

      {fundingType && (
        isEditing ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleSaveEdit()} disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </button>
            <button type="button" onClick={onCancelEdit} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 dark:border-slate-600 dark:text-slate-400">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => void handleConfirm()} disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving…' : canComplete ? 'Confirm funding' : 'Save and check'}
          </button>
        )
      )}
    </div>
  );
}
