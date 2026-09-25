// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TransactionDocCard — one wallet document sent to a deal's Transaction Wallet:
 * label (or slot label) + sent date, a shared-count chip, share switches grouped
 * "Your side" (open) / "Other side" (collapsed, routed-via-conveyancer note),
 * a greyed lender row when the lender isn't on PropXchain, the one-line history
 * (decision 17) and "Remove from deal".
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { ShareParty } from '@/services/shareParty.service';
import type { ShareGrant } from '@/services/documentShare.service';
import type { SentItem } from '@/services/transactionWallet.service';
import { slotDisplayLabel } from '@/utils/vaultSlotLabel';
import { grantKey } from './grantKey';

interface TransactionDocCardProps {
  item: SentItem;
  principal: string;
  yourSide: ShareParty[];
  otherSide: ShareParty[];
  /** Deal lender by name when no lender rep has joined (decision 14). */
  lenderPlaceholder?: string;
  grants: Map<string, ShareGrant>;
  busy: Set<string>;
  history: string;
  onToggle: (item: SentItem, party: ShareParty) => void;
  onRemove: (item: SentItem) => void;
}

function PartySwitch({
  label,
  isOn,
  isBusy,
  onClick,
}: {
  label: string;
  isOn: boolean;
  isBusy: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="truncate text-xs text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        disabled={isBusy}
        onClick={onClick}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          isOn ? 'bg-teal-600' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isOn ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </li>
  );
}

export function TransactionDocCard({
  item,
  principal,
  yourSide,
  otherSide,
  lenderPlaceholder,
  grants,
  busy,
  history,
  onToggle,
  onRemove,
}: TransactionDocCardProps): JSX.Element {
  const [showOthers, setShowOthers] = useState(false);
  const { doc } = item;
  const all = [...yourSide, ...otherSide];
  const sharedCount = all.filter((p) => grants.has(grantKey(doc.fileHash, p.principal))).length;
  const slot = slotDisplayLabel(doc.slotId, principal);
  const title = doc.label ?? slot;

  const renderSwitch = (party: ShareParty): JSX.Element => {
    const key = grantKey(doc.fileHash, party.principal);
    return (
      <PartySwitch
        key={party.principal}
        label={party.label}
        isOn={grants.has(key)}
        isBusy={busy.has(key)}
        onClick={() => onToggle(item, party)}
      />
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              {doc.label ? `${slot} · ` : ''}Sent {new Date(item.sentAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={
            sharedCount > 0
              ? 'shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'
              : 'shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
          }
        >
          {sharedCount > 0
            ? `Shared with ${sharedCount} ${sharedCount === 1 ? 'party' : 'parties'}`
            : 'Not shared'}
        </span>
      </div>

      {all.length === 0 && !lenderPlaceholder ? (
        <p className="mt-3 text-xs text-muted-foreground">No other parties have joined this deal yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {(yourSide.length > 0 || lenderPlaceholder) && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your side</p>
              <ul className="space-y-1.5">
                {yourSide.map(renderSwitch)}
                {lenderPlaceholder && (
                  <li className="flex items-center justify-between gap-2 opacity-60">
                    <span className="truncate text-xs text-foreground">
                      Lender — {lenderPlaceholder}
                      <span className="text-muted-foreground"> · not on PropXchain — invite them or show your QR</span>
                    </span>
                    <span className="inline-flex h-5 w-9 shrink-0 rounded-full bg-muted-foreground/20" aria-hidden />
                  </li>
                )}
              </ul>
            </div>
          )}
          {otherSide.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                aria-expanded={showOthers}
              >
                {showOthers ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Other side ({otherSide.length})
              </button>
              {showOthers && (
                <>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">Normally goes via your conveyancer.</p>
                  <ul className="space-y-1.5">{otherSide.map(renderSwitch)}</ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-border pt-2">
        <p className="truncate text-[11px] text-muted-foreground">{history || 'Not shared yet'}</p>
        <button
          type="button"
          onClick={() => onRemove(item)}
          className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-red-600"
        >
          Remove from deal
        </button>
      </div>
    </div>
  );
}
