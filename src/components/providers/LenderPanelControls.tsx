// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Buyer-side lender-panel UI atoms for the conveyancer stage: capture
 * prompt (lender unknown), filter bar (filter active), fallback banner
 * (lender known but no usable panel data).
 */

import { useEffect, useState } from 'react';
import { lenderPanelService } from '../../services/lenderPanel.service';
import { logger } from '../../utils/logger';

const OTHER_LENDER = '__other__';

interface LenderPromptProps {
  onLenderCaptured: (lender: string) => void;
  onDismiss: () => void;
}

export function LenderPrompt({ onLenderCaptured, onDismiss }: LenderPromptProps): React.ReactElement {
  const [lenders, setLenders] = useState<string[]>([]);
  const [isOther, setIsOther] = useState(false);
  const [otherName, setOtherName] = useState('');

  useEffect(() => {
    lenderPanelService
      .getLenders()
      .then(setLenders)
      .catch((err: unknown) => logger.warn('[lenderPanel] lender list failed', err));
  }, []);

  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 dark:border-teal-400/20 dark:bg-teal-400/5">
      <h4 className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
        Getting a mortgage? Tell us your lender to see firms approved by them
      </h4>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        Lenders only allow firms on their panel to act for them — choosing one
        avoids separate representation costs and delays.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Your mortgage lender"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value === OTHER_LENDER) setIsOther(true);
            else if (e.target.value) {
              setIsOther(false);
              onLenderCaptured(e.target.value);
            }
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0D9488] focus:outline-none dark:border-[#1E2A3A] dark:bg-[#141C2E] dark:text-gray-100"
        >
          <option value="">Select your lender…</option>
          {lenders.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
          <option value={OTHER_LENDER}>Other / not listed</option>
        </select>
        {isOther && (
          <>
            <input
              type="text"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Lender name"
              aria-label="Other lender name"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0D9488] focus:outline-none dark:border-[#1E2A3A] dark:bg-[#141C2E] dark:text-gray-100"
            />
            <button
              type="button"
              disabled={!otherName.trim()}
              onClick={() => onLenderCaptured(otherName.trim())}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40"
            >
              Save
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Skip — no mortgage / decide later
        </button>
      </div>
    </div>
  );
}

interface LenderFilterBarProps {
  lenderName: string;
  /** Total firms on the lender's panel (unbounded by the rendered slice). */
  matchCount: number;
  /** Rows actually rendered below the bar — may be fewer than matchCount. */
  shownCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
}

export function LenderFilterBar({ lenderName, matchCount, shownCount, showAll, onToggleShowAll }: LenderFilterBarProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
      <p className="text-xs text-emerald-700 dark:text-emerald-300">
        {showAll
          ? `Showing all nearby firms — ${matchCount} are on ${lenderName}'s panel`
          : `Showing the ${shownCount} nearest firms on ${lenderName}'s panel (${matchCount} on panel)`}
      </p>
      <button
        type="button"
        onClick={onToggleShowAll}
        className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
      >
        {showAll ? 'Show panel firms only' : 'Show all firms'}
      </button>
    </div>
  );
}

interface LenderFallbackBannerProps {
  lenderName: string;
}

export function LenderFallbackBanner({ lenderName }: LenderFallbackBannerProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
      <p className="text-xs text-amber-700 dark:text-amber-300">
        We don&apos;t hold panel data for {lenderName} — confirm with your chosen
        firm that they can act for your lender.
      </p>
    </div>
  );
}
