// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * MoveNarratorBanner — surfaces the latest Move Narrator "where's my move?"
 * card inline in the open transaction (not only in the notification bell) and
 * pops a toast the moment a new one is delivered.
 *
 * Premium customers get a Narrator card when a transaction's blocker changes
 * (see useMoveNarrator). The card lives in the local notifications store; this
 * banner renders the newest one for the open transaction in context, so it's
 * visible without opening the bell.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Sparkles, X } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '../../hooks/useSubscription';
import { useMoveNarratorNotifications } from '../../hooks/useMoveNarratorNotifications';
import { useDismiss } from '../../hooks/useDismiss';
import { useModalFocus } from '../../hooks/useModalFocus';

/** Storage-tag prefix marking "minimised", matching NextStepCard's scheme. */
const MINIMISED_PREFIX = 'min:';

interface MoveNarratorBannerProps {
  txId: string;
  className?: string;
}

const MoveNarratorBanner: React.FC<MoveNarratorBannerProps> = ({ txId, className = '' }) => {
  const { notifications, markRead } = useMoveNarratorNotifications();
  const { toast } = useToast();
  const { isPremium } = useSubscription();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const seenRef = useRef<Set<string> | null>(null);
  const { dismissedTag: minimisedTag, dismiss: minimise, restore } = useDismiss(`moveNarrator:${txId}`);
  const dialogRef = useRef<HTMLElement>(null);

  const txCards = notifications.filter((n) => n.txId === txId);
  const openCard = isPremium ? txCards.find((n) => !dismissed.has(n.id)) : undefined;
  const isFloating = Boolean(openCard) && minimisedTag !== MINIMISED_PREFIX + openCard?.id;
  const minimiseOpen = useCallback((): void => {
    if (openCard) minimise(MINIMISED_PREFIX + openCard.id);
  }, [openCard, minimise]);
  useModalFocus(dialogRef, isFloating, minimiseOpen);

  // Toast on genuinely new cards. Seed the seen-set on first render so existing
  // cards don't toast on mount — only ones delivered while this is open do. The
  // AI card is a premium feature, so on the starter tier we keep the seen-set
  // current (no toast replay if the tier is later switched to premium) but
  // never toast or render.
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(txCards.map((n) => n.id));
      return;
    }
    for (const card of txCards) {
      if (seenRef.current.has(card.id)) continue;
      seenRef.current.add(card.id);
      if (isPremium) toast({ title: `✨ ${card.title}`, description: card.body });
    }
  }, [txCards, toast, isPremium]);

  // Premium-only: a starter user must not see the AI card, even if one was
  // delivered earlier while premium (so the tier toggle shows a real difference).
  const card = openCard;
  if (!card) return null;

  // Minimised: a single icon in normal flow. The stored tag carries the card id,
  // so when the next AI update is delivered the tag stops matching and the new
  // one floats up by itself — same auto-revive rule as the NextStepCard.
  if (minimisedTag === MINIMISED_PREFIX + card.id) {
    return (
      <button
        type="button"
        data-testid="move-narrator-minimised"
        onClick={restore}
        aria-label="Show the latest AI update"
        title="AI update"
        className={`ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-sage-dark shadow-sm transition-colors hover:border-stone-300 dark:border-stone-700 dark:bg-stone-900 dark:text-emerald-400 ${className}`}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  const isUrgent = card.urgency === 'blocking' || card.urgency === 'soon';
  // The card floats over a bg-black/40 backdrop (see the wrapper below), so its
  // own surface must be fully OPAQUE — a translucent fill here composites with
  // that backdrop into a murky, low-contrast panel instead of a legible card.
  // `accent` therefore only carries the border and the opaque fill's hue; it
  // must never itself be a translucent (/NN) background. Now that sage-dark
  // resolves (see tailwind.config.js), the urgent border goes back to the
  // brand accent used everywhere else in this card (Sparkles icon, "AI update"
  // label below) instead of the emerald standby that covered for it while the
  // sage utility classes were dead — dark mode keeps emerald-700, matching the
  // rest of the file's sage-dark→emerald-400/700 substitution for dark theme.
  const accent = isUrgent
    ? 'border-sage-dark dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
    : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-900';

  const onDismiss = (): void => {
    markRead(card.id);
    setDismissed((prev) => new Set(prev).add(card.id));
  };

  const onMinimise = minimiseOpen;

  return (
    <div
      data-testid="move-narrator-overlay"
      onClick={onMinimise}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
    >
    <article
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`AI update: ${card.title}`}
      onClick={(e) => e.stopPropagation()}
      className={`rounded-lg border ${accent} w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl`}
      data-testid="move-narrator-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sage-dark dark:text-emerald-400 shrink-0" aria-hidden />
          <p className="font-[DM_Sans] text-[10px] font-medium uppercase tracking-wide text-sage-dark dark:text-emerald-400">
            AI update
          </p>
        </div>
        <button
          type="button"
          onClick={onMinimise}
          aria-label="Minimise AI update"
          className="rounded p-1 text-stone-500 dark:text-slate-400 transition-colors hover:bg-stone-100 dark:hover:bg-slate-700 hover:text-stone-700 dark:hover:text-slate-200"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss AI update"
          className="rounded p-1 text-stone-500 dark:text-slate-400 transition-colors hover:bg-stone-100 dark:hover:bg-slate-700 hover:text-stone-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mt-1 font-[Fraunces] text-base font-semibold leading-tight text-stone-900 dark:text-gray-100">
        {card.title}
      </h3>
      <p className="mt-1 font-[DM_Sans] text-sm text-stone-600 dark:text-slate-300">{card.body}</p>
    </article>
    </div>
  );
};

export default MoveNarratorBanner;
