import React from 'react';
import { Check } from 'lucide-react';

export interface SegmentedButtonsProps<T extends string> {
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
  /** Current selection — may legitimately match no option (draft state). */
  value: string;
  onSelect: (value: T) => void;
  disabled?: boolean;
  /** Accessible name for the button group. */
  label: string;
}

/**
 * Generic answer pill row — the base for AnswerButtons and the DocumentSlot
 * status picker. Every choice is a first-class, comfortably tappable button
 * (plan requirement: no dropdowns for legal answers). The selected pill fills
 * with the brand teal and carries a check so state never rides on color alone.
 */
export function SegmentedButtons<T extends string>({
  options,
  labels,
  value,
  onSelect,
  disabled = false,
  label,
}: SegmentedButtonsProps<T>): React.ReactElement {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-700 disabled:opacity-80'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-60'
            }`}
          >
            {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}
