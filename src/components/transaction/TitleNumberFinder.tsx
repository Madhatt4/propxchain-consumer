// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Title Number Finder — free address → title-number lookup.
 *
 * Sellers rarely know their HMLR title number. This widget sits under the
 * Title number field and lets them find it from the address they've already
 * entered, using HM Land Registry's free Search by Property Description
 * service (via the Render proxy `/api/title-search`). Picking a result fills
 * the Title number field, which in turn unlocks the (paid) register pull.
 *
 * Free: no Stripe, no charge — this is a pre-purchase lookup.
 */

import { useCallback, useState } from 'react';
import {
  hmlrTitleService,
  splitAddressLine1,
  type HmlrTitleMatch,
} from '@/services/hmlrTitle.service';
import { logger } from '@/utils/logger';

interface Props {
  postcode: string;
  addressLine1: string;
  /** Called with the chosen HMLR title number when the user picks a match. */
  onSelect: (titleNumber: string) => void;
}

type Status = 'idle' | 'searching' | 'results' | 'empty' | 'rejected' | 'error';

export default function TitleNumberFinder({
  postcode,
  addressLine1,
  onSelect,
}: Props): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [matches, setMatches] = useState<HmlrTitleMatch[]>([]);
  const [message, setMessage] = useState('');

  const canSearch = postcode.trim().length > 0;

  const runSearch = useCallback(async () => {
    setStatus('searching');
    setMessage('');
    setMatches([]);
    try {
      const { houseNumber, houseName, streetName } =
        splitAddressLine1(addressLine1);
      const result = await hmlrTitleService.searchTitlesByAddress({
        postcode,
        houseNumber,
        houseName,
        streetName,
      });

      if (result.typeCode === 30 && result.matches.length > 0) {
        setMatches(result.matches);
        setStatus('results');
      } else if (result.acknowledgement || result.typeCode === 10) {
        // TypeCode 10 — HMLR is out of hours and has queued the request
        // (evenings/weekends). NOT the same as "no titles matched" — say so,
        // or a perfectly good address looks like a failed search (2026-07-22).
        setMessage(
          'HM Land Registry’s search service is out of hours right now, so it can’t answer immediately. Try again during business hours (weekday daytime).',
        );
        setStatus('rejected');
      } else if (result.rejection) {
        // TypeCode 20 — HMLR rejected the criteria (usually "insufficient
        // address details"). Surface its own wording; it's genuinely helpful.
        // Imported listings are street-only (no house number), so when that's
        // the case say what actually fixes it rather than just relaying HMLR.
        const noHouse = !houseNumber && !houseName;
        setMessage(
          (result.rejection.reason ||
            'HM Land Registry needs more address detail to search.') +
            (noHouse
              ? ' Add your house number or name to Address line 1 and search again.'
              : ''),
        );
        setStatus('rejected');
      } else {
        setStatus('empty');
      }
    } catch (err) {
      logger.warn('Title number search failed', err);
      setMessage(
        err instanceof Error
          ? err.message
          : 'The search could not be completed. Please try again.',
      );
      setStatus('error');
    }
  }, [postcode, addressLine1]);

  const handlePick = useCallback(
    (titleNumber: string) => {
      onSelect(titleNumber);
      setOpen(false);
      setStatus('idle');
      setMatches([]);
    },
    [onSelect],
  );

  if (!open) {
    return (
      /* This is the help for the blocker the next-step card sends people here
         to clear ("Look up the title number on HMLR"). It was 12px, 16px tall,
         with an underline only on hover — the least visible thing on the page
         at the exact moment the user is stuck. Found walking the seller flow
         in a real browser on 2026-07-31.

         It is a standalone control, not a link inside a sentence, so the
         WCAG 2.5.5 inline exception does not apply and it gets a real 44px
         target. */
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        Don&rsquo;t know your title number? Find it from your address &rarr;
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-600/30 bg-teal-50 dark:border-teal-500/40 dark:bg-teal-950/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Find your title number
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Free search of HM Land Registry using your address above
            {canSearch ? '' : ' — enter a postcode first'}.
          </p>
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={!canSearch || status === 'searching'}
          className="shrink-0 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          {status === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </div>

      {status === 'results' && (
        <ul className="mt-3 divide-y divide-teal-600/15 overflow-hidden rounded-md border border-teal-600/20 bg-white dark:bg-slate-800">
          {matches.map((m, i) => (
            <li key={`${m.titleNumber}-${i}`}>
              <button
                type="button"
                onClick={() => handlePick(m.titleNumber)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-gray-900 dark:text-gray-100">
                    {m.addressDisplay || '(address unavailable)'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {m.tenure}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm font-semibold text-teal-700 dark:text-teal-400">
                  {m.titleNumber}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status === 'empty' && (
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          No registered titles matched that address. Check the house
          number/name and postcode, or enter the title number directly.
        </p>
      )}

      {status === 'rejected' && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{message}</p>
      )}

      {status === 'error' && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{message}</p>
      )}
    </div>
  );
}
