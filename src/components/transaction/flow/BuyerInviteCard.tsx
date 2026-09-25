// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * BuyerInviteCard
 *
 * Prominent invite-code surface shown to the seller on
 * /transaction/:id/flow until a buyer has joined. The code was
 * previously only visible inside PropertyListingCard (which requires
 * Stage 1 done) or on the separate /transaction/:id/share page. For
 * the first-time seller the invite code is the most important thing
 * on the page.
 *
 * Render logic: Only shown when (a) the viewer is the seller and
 * (b) the canister record still has buyer == seller (no real buyer
 * joined yet) and (c) inviteCode is set. Swaps to a subtle "joined"
 * confirmation after the buyer joins.
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import { Copy, Check, UserPlus, X } from 'lucide-react';

interface BuyerInviteCardProps {
  inviteCode: string | null | undefined;
  /** True once a real buyer (principal != seller) has joined the transaction. */
  buyerJoined: boolean;
  /** Called when the user clicks the X to hide the card. Parent owns
   *  persistence so the same dismiss can render a restore pill in place. */
  onDismiss?: () => void;
}

export function BuyerInviteCard({ inviteCode, buyerJoined, onDismiss }: BuyerInviteCardProps): ReactElement | null {
  const [copied, setCopied] = useState(false);

  if (!inviteCode) return null;

  // Buyer already joined — subtle confirmation, not a call to action.
  if (buyerJoined) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="text-sm text-emerald-700 dark:text-emerald-300 font-['DM_Sans']">
          Buyer has joined the transaction
        </span>
      </div>
    );
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked — no-op.
    }
  };

  return (
    <div className="rounded-xl bg-teal-500/10 dark:bg-teal-500/15 border border-teal-500/30 p-4 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between gap-2 mb-3 relative">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-[2px]">
            Buyer invite code
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Hide buyer invite card"
            title="Hide for this transaction"
            className="rounded-md p-1 text-teal-700/60 hover:bg-teal-500/10 hover:text-teal-700 dark:text-teal-400/60 dark:hover:bg-teal-500/15 dark:hover:text-teal-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="font-mono font-black text-2xl text-gray-900 dark:text-white tracking-[4px] mb-2 relative">
        {inviteCode}
      </p>

      <div className="flex items-center justify-between gap-3 relative">
        <p className="text-xs text-gray-600 dark:text-slate-400 font-['DM_Sans']">
          Share with the buyer to join this transaction.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-bold transition-colors"
          aria-label={copied ? 'Copied' : 'Copy invite code'}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default BuyerInviteCard;
