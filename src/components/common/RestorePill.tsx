// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Compact button rendered in place of a dismissed card. Single-line, low
 * visual weight, tells the user the card is hidden and one click brings it
 * back.
 */

import type { ReactElement } from 'react';
import { Eye } from 'lucide-react';

interface RestorePillProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export function RestorePill({ label, onClick, className = '' }: RestorePillProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 font-sans text-xs text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 ${className}`}
      aria-label={`Show hidden ${label}`}
    >
      <Eye className="h-3 w-3" />
      Show {label}
    </button>
  );
}

export default RestorePill;
