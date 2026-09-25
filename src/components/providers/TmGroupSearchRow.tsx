/**
 * One selectable search line in the tmGroup card.
 *
 * Extracted because the area-specific and optional lists rendered the same
 * checkbox, label and price markup twice with only the warning glyph differing —
 * and because SearchPackageBuilder was over the 300-line rule.
 */

import { priceLabel, unpricedLabel } from './tmGroupCardHelpers';

interface TmGroupSearchRowProps {
  name: string;
  pricePence: number;
  isChecked: boolean;
  onToggle: () => void;
  /** Area-specific rows carry a warning glyph; optional rows do not. */
  warn?: boolean;
  /**
   * tmGroup could not price this product for this property. Shown greyed and
   * unselectable rather than letting somebody tick it and fail at checkout —
   * which is exactly what happened on 2026-08-16 with the Highways enquiry.
   */
  unavailable?: boolean;
  /**
   * An unpriced line BEFORE anybody has pressed Refresh quote. tmGroup's
   * provider lookup on a new draft has a timing gap (Rhys, 2026-08-18), so the
   * first unpriced answer is more likely their queue than the property. Once a
   * refresh has been tried and the line is still unpriced, it reads as
   * "Not available here" — that is the property.
   */
  suggestRefresh?: boolean;
}

export default function TmGroupSearchRow({
  name,
  pricePence,
  isChecked,
  onToggle,
  warn = false,
  unavailable = false,
  suggestRefresh = false,
}: TmGroupSearchRowProps): JSX.Element {
  return (
    <div className={`flex items-center justify-between${unavailable ? ' opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isChecked}
          disabled={unavailable}
          onClick={onToggle}
          className={[
            'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
            unavailable
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800'
              : isChecked
                ? 'border-teal-500 bg-teal-500'
                : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800',
          ].join(' ')}
          aria-label={`Toggle ${name}`}
        >
          {isChecked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2.5}>
              <path d="M1 4l3 3 5-5" />
            </svg>
          )}
        </button>
        <span className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
          {warn && (
            <span className="text-amber-500" aria-hidden>
              ⚠
            </span>
          )}
          {name}
        </span>
      </div>
      <span
        className={
          unavailable && suggestRefresh
            ? 'text-right text-xs text-amber-700 dark:text-amber-400'
            : 'font-mono tabular-nums text-sm text-gray-600 dark:text-gray-400'
        }
      >
        {unavailable ? unpricedLabel(suggestRefresh) : priceLabel(pricePence)}
      </span>
    </div>
  );
}
