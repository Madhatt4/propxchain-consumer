// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Eye, Lightbulb, Minus, RefreshCw, X } from 'lucide-react';
import { ICON_BUTTON as TOPBAR_ICON_BUTTON } from '../navigation/AppTopBar';
import {
  getNextStep,
  type NextStepRecommendation,
  type NextStepError,
  type NextStepOption,
  type NextStepUrgency,
} from '../../services/next-step.service';
import { useDismiss } from '../../hooks/useDismiss';
import { useCanAccessFeature } from '../../hooks/useSubscription';
import { useModalFocus } from '../../hooks/useModalFocus';
import RestorePill from './RestorePill';

export type NextStepCardVariant = 'compact' | 'full';

interface NextStepCardProps {
  txId: string;
  variant?: NextStepCardVariant;
  className?: string;
  /**
   * Show an X close button that hides the card for this txId until the
   * blocker changes OR the user clicks the restore pill. Stored in
   * localStorage. Defaults to true on the full variant (page-level
   * surface) and false on compact (stack mounts where many cards are
   * listed).
   */
  dismissible?: boolean;
  /**
   * Bump this to force a re-fetch of the next-step recommendation. Used
   * by the parent to invalidate the card after on-chain edits land
   * (title-number update, stage completion, etc.) so the displayed
   * blocker reflects current state instead of the stale snapshot from
   * the initial mount fetch.
   */
  refreshKey?: number | string;
  /**
   * Take the user to where the recommended action happens.
   *
   * Until 2026-07-28 this card had NO clickable options at all: each one
   * rendered as an <li> of text. The app worked out the next step, said it
   * in plain English, then left the user to go and find it — the single
   * biggest cause of "I can't see where to go next" in the UX audit
   * (docs/2026-07-28-consumer-ux-audit.md). The routing target was already
   * present as `opt.action`; it was just used as a React key and never wired.
   *
   * Optional on purpose. Where a parent can't act on an action (the builder
   * stack mounts a card per plot and has nowhere to send you), omit it and
   * options stay non-interactive rather than lying about being clickable.
   */
  onAction?: (action: string, option: NextStepOption) => void;
  /**
   * Offer a second, softer hide: minimise to a small icon anchored top-right
   * rather than the inline restore pill.
   *
   * Close and minimise both hide the card until the blocker changes — the
   * difference is what they leave behind. Close leaves the inline pill in the
   * document flow; minimise leaves a single icon pinned to the corner of the
   * panel, so a user reading a transaction gets the whole width back.
   *
   * Off by default, so existing mounts (TransactionFlowPage, the builder plot
   * stack) keep exactly the behaviour they had.
   *
   * The minimised icon stays in normal flow and pushes itself right with
   * `ml-auto`. It is deliberately NOT absolutely positioned: a wrapper whose
   * only child is absolute collapses to zero height, and the icon then overlaps
   * whatever the parent renders next. Flow layout also means no parent has to
   * remember to be `position: relative`.
   */
  minimisable?: boolean;
  /**
   * `inline` (default) renders in the page flow, as every existing mount does.
   *
   * `overlay` floats it centred over the page, like the welcome cards. Used
   * when opening a transaction: the next step is the first thing you see, then
   * it gets out of the way entirely rather than holding a hero-sized strip of
   * screen for the rest of the visit. Implies `minimisable`.
   */
  presentation?: 'inline' | 'overlay';
  /**
   * DOM id to portal the minimised lightbulb into — the top bar's action slot,
   * so the restore control sits with the other icon buttons instead of
   * floating on its own. The card itself still renders in place.
   */
  minimisedPortalId?: string;
}

/** Storage-tag prefix marking "minimised", to tell it apart from a close. */
const MINIMISED_PREFIX = 'min:';

interface State {
  status: 'loading' | 'success' | 'empty' | 'error';
  data?: NextStepRecommendation;
  error?: NextStepError;
}

/**
 * NextStepCard
 *
 * Surfaces the highest-priority blocker on a transaction plus a ranked set
 * of options to resolve it. Driven by the canister rules engine
 * (`transaction_manager.getNextStep`) — same recommendation that feeds the
 * MCP `propxchain_next_step` tool. No parallel logic.
 *
 * Two render variants:
 *   - `compact`: drawer / kanban embedding. Headline + top option only.
 *   - `full`:    page-level. Headline + all options + "why" rationale.
 *
 * Five interaction states (per F.3 plan):
 *   loading | success | empty (no blockers) | error | partial (banner
 *   surfaced inside `success` when the canister flagged degraded signals).
 *
 * DESIGN.md compliance:
 *   - Headline: Fraunces (font-display)
 *   - Body / options: DM Sans (font-sans)
 *   - Inline numerics: Geist Mono (font-mono)
 *   - Urgency colour: sage-dark for #blocking and #soon (NOT amber/red).
 */
const NextStepCard: React.FC<NextStepCardProps> = ({
  txId,
  variant = 'full',
  className = '',
  dismissible,
  refreshKey,
  onAction,
  minimisable = false,
  presentation = 'inline',
  minimisedPortalId,
}) => {
  const isOverlay = presentation === 'overlay';
  const canSeeCard = useCanAccessFeature('next_step_recommendations');
  // Resolved after mount — the slot belongs to the top bar, which may not be
  // in the DOM when this first renders.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!minimisedPortalId) return;
    setPortalTarget(document.getElementById(minimisedPortalId));
  }, [minimisedPortalId]);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [manualBump, setManualBump] = useState(0);
  const { dismissedTag, dismiss, restore } = useDismiss(`nextStep:${txId}`);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!canSeeCard) return;
    let active = true;
    setState({ status: 'loading' });
    void (async () => {
      const result = await getNextStep(txId);
      if (!active) return;
      if ('err' in result) {
        setState({ status: 'error', error: result.err });
        return;
      }
      if (result.ok.blocker === 'none') {
        setState({ status: 'empty', data: result.ok });
        return;
      }
      setState({ status: 'success', data: result.ok });
    })();
    return () => {
      active = false;
    };
  }, [txId, refreshKey, manualBump, canSeeCard]);

  // Escape minimises rather than closes: it is the recoverable one, and a modal
  // with no keyboard exit is a trap. Focus handling is shared with the AI card
  // (useModalFocus) so the two floating surfaces cannot drift apart — the tier
  // toggle swaps between them, which is exactly where drift would show.
  const minimiseCurrent = useCallback((): void => {
    if (state.status !== 'success' || !state.data) return;
    dismiss(MINIMISED_PREFIX + state.data.blocker);
  }, [state, dismiss]);

  const isFloating =
    isOverlay && state.status === 'success' && dismissedTag !== MINIMISED_PREFIX + state.data?.blocker;

  useModalFocus(cardRef, isFloating, minimiseCurrent);

  if (!canSeeCard) return null;

  const handleRefresh = (): void => {
    setState({ status: 'loading' });
    setManualBump((n) => n + 1);
  };

  // Default: dismissible on full, not on compact (stack mounts get noisy).
  const canDismiss = dismissible ?? variant === 'full';

  const handleDismiss = (): void => {
    if (state.status !== 'success' || !state.data) return;
    dismiss(state.data.blocker);
  };

  const handleMinimise = (): void => {
    if (state.status !== 'success' || !state.data) return;
    dismiss(MINIMISED_PREFIX + state.data.blocker);
  };

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-label="Loading next-step recommendation"
        className={`rounded-lg border border-sage-light/30 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 p-4 ${className}`}
      >
        <div className="h-4 w-2/3 animate-pulse rounded bg-sage-light/40 dark:bg-slate-700/60" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-sage-light/30 dark:bg-slate-700/40" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className={`rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-900 dark:text-rose-300 ${className}`}
      >
        <p className="font-display font-medium">Couldn't load next step</p>
        <p className="mt-1 font-sans">{state.error?.message ?? 'Unknown error'}</p>
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div
        className={`rounded-lg border border-sage-light/40 dark:border-slate-700 bg-sage-light/10 dark:bg-slate-800/30 p-4 ${className}`}
        data-testid="next-step-empty"
      >
        <p className="font-display text-base text-sage-dark dark:text-emerald-400">You're up to date</p>
        <p className="mt-1 font-sans text-sm text-stone-600 dark:text-slate-400">
          No blockers detected for this transaction.
        </p>
      </div>
    );
  }

  const rec = state.data!;

  // User dismissed this exact blocker for this tx — render a restore pill in
  // place so they can bring the card back. When the blocker changes (e.g.
  // they appoint a solicitor → next blocker emerges) the storage tag no
  // longer matches and the full card reappears automatically.
  if (dismissedTag === rec.blocker) {
    // With a slot, the restore control joins the bar's icon buttons as an eye
    // — a labelled pill alone on the page was the last thing holding the strip
    // above the stages open. Without one it stays the inline pill.
    if (minimisedPortalId) {
      const restoreButton = (
        <button
          type="button"
          data-testid="next-step-restore"
          onClick={restore}
          aria-label="Show hidden next step"
          title="Next step"
          className={TOPBAR_ICON_BUTTON}
        >
          <Eye className="h-[18px] w-[18px]" />
        </button>
      );
      return portalTarget ? createPortal(restoreButton, portalTarget) : null;
    }
    return (
      <RestorePill label="next step" onClick={restore} className={className} />
    );
  }

  // Minimised: a single icon. Same auto-revive rule — the tag carries the
  // blocker, so when the blocker moves on, the stored tag stops matching and
  // the card comes back by itself. With `minimisedPortalId` the icon moves
  // into the top bar's action row rather than sitting on the page.
  if (dismissedTag === MINIMISED_PREFIX + rec.blocker) {
    const minimisedButton = (
      <button
        type="button"
        data-testid="next-step-minimised"
        onClick={restore}
        aria-label="Show the next step for this transaction"
        title="Next step"
        className={
          portalTarget
            ? TOPBAR_ICON_BUTTON
            : `ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:text-white ${className}`
        }
      >
        <Lightbulb className={portalTarget ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
      </button>
    );

    if (minimisedPortalId) {
      return portalTarget ? createPortal(minimisedButton, portalTarget) : null;
    }
    return minimisedButton;
  }

  const visibleOptions = variant === 'compact' ? rec.options.slice(0, 1) : rec.options;

  const card = (
    <article
      ref={cardRef}
      tabIndex={isOverlay ? -1 : undefined}
      data-testid="next-step-card"
      data-blocker={rec.blocker}
      data-urgency={rec.urgency}
      role={isOverlay ? 'dialog' : undefined}
      aria-modal={isOverlay ? true : undefined}
      aria-label={isOverlay ? `Next step: ${rec.blockerLabel}` : undefined}
      onClick={isOverlay ? (e) => e.stopPropagation() : undefined}
      className={`rounded-lg border ${urgencyBorder(rec.urgency)} bg-white dark:bg-slate-800 p-4 shadow-sm ${
        isOverlay ? 'w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl' : ''
      } ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-xs uppercase tracking-wide text-stone-500 dark:text-slate-400">Next step</p>
          <h3 className="mt-0.5 font-display text-lg leading-tight text-stone-900 dark:text-gray-100">
            {rec.blockerLabel}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <UrgencyBadge urgency={rec.urgency} />
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh next-step recommendation"
            title="Refresh"
            className="rounded-md p-2.5 min-h-11 min-w-11 flex items-center justify-center text-stone-400 dark:text-slate-500 transition-colors hover:bg-stone-100 dark:hover:bg-slate-700 hover:text-stone-700 dark:hover:text-slate-200"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {(minimisable || isOverlay) && (
            <button
              type="button"
              onClick={handleMinimise}
              aria-label="Minimise next-step card"
              title="Minimise"
              className="rounded-md p-2.5 min-h-11 min-w-11 flex items-center justify-center text-stone-400 dark:text-slate-500 transition-colors hover:bg-stone-100 dark:hover:bg-slate-700 hover:text-stone-700 dark:hover:text-slate-200"
            >
              <Minus className="h-4 w-4" />
            </button>
          )}
          {canDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Hide next-step card for this transaction"
              title="Hide until next blocker"
              className="rounded-md p-2.5 min-h-11 min-w-11 flex items-center justify-center text-stone-400 dark:text-slate-500 transition-colors hover:bg-stone-100 dark:hover:bg-slate-700 hover:text-stone-700 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {rec.partial && (
        <p className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 font-sans text-xs text-amber-900 dark:text-amber-300">
          Showing partial recommendations — some signals were not available.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {visibleOptions.map((opt) => {
          const body = (
            <>
              <p className="font-sans font-medium text-stone-900 dark:text-gray-100">
                {opt.displayLabel}
                {opt.panelMatchCount !== undefined && (
                  <span className="ml-1 font-mono text-xs text-sage-dark dark:text-emerald-400">
                    ({opt.panelMatchCount} firms)
                  </span>
                )}
                {opt.estimatedDelayIfSkipped !== undefined && (
                  <span className="ml-2 font-mono text-xs text-stone-500 dark:text-slate-400">
                    ~{opt.estimatedDelayIfSkipped}d delay if skipped
                  </span>
                )}
              </p>
              {variant === 'full' && (
                <p className="mt-1 font-sans text-sm text-stone-600 dark:text-slate-300">{opt.whyThis}</p>
              )}
            </>
          );

          // With a handler, the option becomes a real control: full-width
          // button, 44px minimum (WCAG 2.5.5), chevron so it reads as
          // "goes somewhere". Without one it stays exactly as it was —
          // never render something that looks clickable but isn't.
          return (
            <li key={opt.action}>
              {onAction ? (
                <button
                  type="button"
                  onClick={() => {
                    // Minimise BEFORE handing over. Acting on the advice is the
                    // strongest signal it has been read, and today onAction only
                    // moves the user within this page — but if it ever navigates
                    // away, a minimise call afterwards would not run, and the
                    // card would still be sitting there on return.
                    //
                    // Minimise rather than close: the user is being sent
                    // somewhere, and a card over the destination would hide the
                    // very field it just told them to fill. The icon keeps it
                    // one click back.
                    if (isOverlay) handleMinimise();
                    onAction(opt.action, opt);
                  }}
                  className="flex w-full min-h-11 items-center justify-between gap-3 rounded border border-sage-light/40 dark:border-slate-700 bg-sage-light/5 dark:bg-slate-900/40 p-3 text-left transition-colors hover:border-sage-dark hover:bg-sage-light/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark dark:hover:bg-slate-800/60"
                >
                  <span className="min-w-0">{body}</span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-sage-dark dark:text-emerald-400"
                    aria-hidden
                  />
                </button>
              ) : (
                <div className="rounded border border-sage-light/40 dark:border-slate-700 bg-sage-light/5 dark:bg-slate-900/40 p-3">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {variant === 'full' && (
        <p className="mt-3 font-sans text-xs italic text-stone-500 dark:text-slate-400">{rec.why}</p>
      )}
    </article>
  );

  if (!isOverlay) return card;

  // Floating and centred, like the welcome cards. Clicking away minimises
  // rather than closes: minimise is the recoverable one — it leaves the icon
  // behind — so it is the safer thing to do on an accidental backdrop tap.
  return (
    <div
      data-testid="next-step-overlay"
      onClick={handleMinimise}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
    >
      {card}
    </div>
  );
};

function urgencyBorder(urgency: NextStepUrgency): string {
  switch (urgency) {
    case 'blocking':
      return 'border-sage-dark';
    case 'soon':
      return 'border-sage-light';
    case 'later':
      return 'border-stone-200';
  }
}

const UrgencyBadge: React.FC<{ urgency: NextStepUrgency }> = ({ urgency }) => {
  const label = urgency === 'blocking' ? 'Blocking' : urgency === 'soon' ? 'Soon' : 'Later';
  const tone =
    urgency === 'blocking'
      ? 'bg-sage-dark text-white'
      : urgency === 'soon'
        ? 'bg-sage-light text-sage-dark dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-stone-100 text-stone-700 dark:bg-slate-700 dark:text-slate-300';
  return (
    <span className={`rounded-full px-2 py-0.5 font-sans text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
};

export default NextStepCard;
