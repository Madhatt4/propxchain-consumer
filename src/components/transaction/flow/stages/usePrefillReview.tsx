import { useState, useCallback, type ReactElement } from 'react';

/**
 * Tracks which auto-filled ("pre-filled from the listing") fields the user has
 * reviewed. A field counts as reviewed once it is edited or explicitly
 * acknowledged. Consumers gate submit on `pendingKeys` so an imported value is
 * never silently accepted without the user glancing at it.
 *
 * Honest by design: every field the import populated is surfaced for review
 * regardless of source (deterministic adapter scrape, JSON-LD, or LLM
 * extraction). The chip reads "Pre-filled", not "AI" — a Rightmove scrape is
 * not AI, and mislabelling it as such would be the same false signal the
 * exchange-stage fix removed.
 */
export function usePrefillReview<K extends string>(prefilled?: ReadonlySet<K>): {
  isPending: (key: K) => boolean;
  markReviewed: (key: K) => void;
  markAllReviewed: () => void;
  pendingKeys: K[];
} {
  const [reviewed, setReviewed] = useState<ReadonlySet<K>>(() => new Set<K>());

  const markReviewed = useCallback((key: K): void => {
    setReviewed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const markAllReviewed = useCallback((): void => {
    if (prefilled) setReviewed(new Set(prefilled));
  }, [prefilled]);

  const isPending = useCallback(
    (key: K): boolean => Boolean(prefilled?.has(key)) && !reviewed.has(key),
    [prefilled, reviewed],
  );

  const pendingKeys = prefilled ? [...prefilled].filter((k) => !reviewed.has(k)) : [];

  return { isPending, markReviewed, markAllReviewed, pendingKeys };
}

/** Teal treatment applied to a pre-filled input until it is reviewed (DESIGN.md
 *  AI/auto pre-fill convention). Merge over the base input class with `cn` so
 *  tailwind-merge resolves the border/background conflicts. */
export const PREFILLED_INPUT_CLASS =
  'border-teal-500 bg-teal-50 dark:border-teal-500/60 dark:bg-teal-950/30';

/** Small chip shown next to a pre-filled field's label; clears on review. */
export function PrefilledChip(): ReactElement {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
      Pre-filled
    </span>
  );
}
