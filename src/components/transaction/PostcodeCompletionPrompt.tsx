// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Inline prompt for completing an outcode-only postcode.
 *
 * Listing imports from Rightmove / OnTheMarket / Hiizzy surface only the
 * outcode (e.g. "SG19") because public listing pages hide the incode behind
 * a sign-in wall. Anywhere we need a full postcode to fetch paid or precise
 * data (property intelligence, HMLR title search, SDLT calculation), we
 * drop this prompt in so the user can complete it inline.
 *
 * Outcode is shown as a pre-filled prefix; the user types the incode
 * (e.g. "8AB"). Validates via postcodeService.completePostcode and calls
 * onComplete with the formatted full postcode (e.g. "SG19 8AB").
 *
 * Scope: completion only. Persistence (writing back to the listing /
 * canister) is the caller's choice — onComplete is fire-and-forget.
 */

import { useState, type ReactElement } from 'react';
import { postcodeService } from '@/services/postcodeService';

export interface PostcodeCompletionPromptProps {
  /** Outcode the listing already gave us. Must be a valid outcode. */
  outcode: string;
  /**
   * Short explanation of what the full postcode unlocks. Shown above the
   * input. E.g. "Add the rest of your postcode for flood risk, sold prices,
   * and council tax band."
   */
  reason: string;
  /** Called with the formatted full postcode (e.g. "SG19 8AB"). */
  onComplete: (fullPostcode: string) => void;
  /** Override the primary button label. Defaults to "Unlock". */
  ctaLabel?: string;
}

export function PostcodeCompletionPrompt({
  outcode,
  reason,
  onComplete,
  ctaLabel = 'Unlock',
}: PostcodeCompletionPromptProps): ReactElement | null {
  const [incode, setIncode] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!postcodeService.isOutcodeOnly(outcode)) {
    // Defensive — caller shouldn't render us with a non-outcode but
    // bail silently rather than throw mid-render.
    return null;
  }

  const displayedOutcode = postcodeService.splitPostcode(outcode).outcode;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const completed = postcodeService.completePostcode(displayedOutcode, incode);
    if (!completed) {
      setError('That doesn\'t look like a valid postcode. Expected 3 chars like "8AB".');
      return;
    }
    setError('');
    onComplete(completed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
      aria-label="Complete postcode"
    >
      <p className="text-amber-900">{reason}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="rounded bg-white px-2 py-1 font-mono text-sm text-gray-700 ring-1 ring-gray-300"
          aria-label="Known outcode"
        >
          {displayedOutcode}
        </span>
        <input
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          value={incode}
          onChange={(e) => setIncode(e.target.value.toUpperCase())}
          maxLength={4}
          placeholder="8AB"
          aria-label="Incode (rest of postcode)"
          className="w-24 rounded border border-gray-300 px-2 py-1 font-mono text-sm uppercase focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={incode.trim().length < 3}
          className="rounded bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {ctaLabel}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}

export default PostcodeCompletionPrompt;
