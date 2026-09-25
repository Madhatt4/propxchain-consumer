/**
 * First-run welcome carousel for the dashboard.
 *
 * This is an explainer, not a UI tour — it never points at a button. A first-time
 * mover does not know the order of a conveyancing transaction, and the dashboard
 * assumes they do. Copy lives in welcomeCardsContent.ts.
 *
 * Touch targets are held at 44px (WCAG 2.5.5) from the start rather than swept
 * for afterwards.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WELCOME_CARDS } from './welcomeCardsContent';

interface WelcomeCardsProps {
  readonly isOpen: boolean;
  /** Called on every close. `dontShowAgain` is true unless the user explicitly asked to be reminded. */
  readonly onClose: (dontShowAgain: boolean) => void;
}

const TOUCH_TARGET = 'min-h-[44px] min-w-[44px]';

const WelcomeCards: React.FC<WelcomeCardsProps> = ({ isOpen, onClose }) => {
  const [index, setIndex] = useState(0);
  const [remindMe, setRemindMe] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const card = WELCOME_CARDS[index];
  const isLast = index === WELCOME_CARDS.length - 1;

  const close = useCallback(() => {
    onClose(!remindMe);
  }, [onClose, remindMe]);

  // Escape closes. Without this the modal is a trap for keyboard users.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // Focus the heading on open AND on every card change. Without the index
  // dependency a screen-reader user stays parked on the previous card's heading
  // after pressing Next, and only the aria-live step counter tells them anything
  // moved. (Yoda, 2026-08-05.)
  useEffect(() => {
    if (isOpen) headingRef.current?.focus();
  }, [isOpen, index]);

  if (!isOpen || !card) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={close}
      data-testid="welcome-cards-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-cards-heading"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="card w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 outline-none"
      >
        <h2
          id="welcome-cards-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-[var(--text-main)] text-xl sm:text-2xl font-bold mb-3 outline-none"
        >
          {card.heading}
        </h2>

        <p className="text-[var(--text-secondary)] mb-4 leading-relaxed">{card.intro}</p>

        {card.steps && (
          <ol className="list-none p-0 m-0 mb-4 space-y-3">
            {card.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[var(--text-main)] font-semibold">{step.title}</span>
                  <span className="block text-[var(--text-secondary)] text-sm">{step.why}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        {card.outro && (
          <p className="text-[var(--text-secondary)] mb-4 leading-relaxed">{card.outro}</p>
        )}

        <div className="flex items-center justify-center gap-2 my-4" aria-hidden="true">
          {WELCOME_CARDS.map((c, i) => (
            <span
              key={c.id}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-blue-600' : 'w-2 bg-stone-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Step {index + 1} of {WELCOME_CARDS.length}
        </p>

        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className={`${TOUCH_TARGET} px-4 rounded-lg border border-stone-300 dark:border-gray-600 bg-transparent text-stone-700 dark:text-gray-300 font-semibold disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Back
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={close}
              className={`${TOUCH_TARGET} px-6 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer`}
            >
              Get started
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(WELCOME_CARDS.length - 1, i + 1))}
              className={`${TOUCH_TARGET} px-6 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer`}
            >
              Next
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={remindMe}
            onChange={(e) => setRemindMe(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          Show this again next time
        </label>
      </div>
    </div>
  );
};

export default WelcomeCards;
