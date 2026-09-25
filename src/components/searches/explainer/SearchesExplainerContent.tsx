// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The searches explainer, as content only. Rendered identically by the
 * first-visit modal and the collapsed card — one component, two wrappers, so
 * dismissing the modal discards nothing.
 *
 * Correct and complete with `narration` absent: the deterministic engine owns
 * every fact here, and Claude only ever rewrites the opening paragraphs.
 */

import React from 'react';
import { Link } from 'react-router-dom';

import type { ExplainerEntry, ExplainerModel } from './searchExplainerModel';
import { computeAllBundleComparisons } from './bundleComparison';

const GUIDE_PATH = '/resources/searches-and-legal/property-searches-explained';

function pounds(pence: number): string {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`;
}

const EntryRow: React.FC<{ entry: ExplainerEntry }> = ({ entry }) => (
  <li className="border-l-2 border-[#84A98C]/50 py-1 pl-3">
    <p className="font-dm-sans text-sm font-medium text-gray-900 dark:text-gray-100">
      {entry.searchType.name}
    </p>
    <p className="font-dm-sans text-xs text-gray-600 dark:text-gray-400">
      {entry.hedged ? `Possibly relevant — ${entry.reason}` : entry.reason}
    </p>
    <p className="font-geist-mono text-[0.65rem] uppercase tracking-wide text-gray-400">
      {entry.searchType.typicalTurnaround} · valid {entry.searchType.validityPeriod} days
    </p>
  </li>
);

export interface SearchesExplainerContentProps {
  model: ExplainerModel;
  localAuthorityName: string;
  /** Claude-written paragraphs. Absent until the edge function answers, and forever if it fails. */
  narration?: string[];
}

export default function SearchesExplainerContent({
  model,
  localAuthorityName,
  narration,
}: SearchesExplainerContentProps): React.ReactElement {
  const comparisons = computeAllBundleComparisons();

  return (
    <div className="space-y-4">
      {narration && narration.length > 0 && (
        <div className="space-y-2">
          {narration.map((paragraph) => (
            <p
              key={paragraph}
              className="font-dm-sans text-sm leading-relaxed text-gray-700 dark:text-gray-300"
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {model.required.length > 0 && (
        <section>
          <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#5F8A68]">
            Typically ordered for a property like this
          </h4>
          <ul className="mt-2 space-y-2">
            {model.required.map((entry) => (
              <EntryRow key={entry.searchType.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}

      {model.recommended.length > 0 && (
        <section>
          <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#5F8A68]">
            Worth considering here
          </h4>
          <ul className="mt-2 space-y-2">
            {model.recommended.map((entry) => (
              <EntryRow key={entry.searchType.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}

      {model.notNeeded.length > 0 && (
        <section>
          <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-gray-400">
            Not usually ordered in {localAuthorityName || 'this area'}
          </h4>
          <p className="mt-1 font-dm-sans text-xs text-gray-500 dark:text-gray-400">
            {model.notNeeded.map((searchType) => searchType.name).join(' · ')}
          </p>
        </section>
      )}

      <section className="rounded-lg bg-gray-50 p-3 dark:bg-[#0F1729]">
        <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-gray-400">
          Where each search comes from
        </h4>
        <p className="mt-1 font-dm-sans text-xs leading-relaxed text-gray-600 dark:text-gray-400">
          Your local authority search (LLC1 + CON29) and drainage &amp; water come from OneSearch
          or tmGroup — that is the core pack. OneSearch sells it as a pack and does not publish
          per-item prices; tmGroup prices each property individually, so open their card for a
          live quote.
        </p>
        <p className="mt-2 font-dm-sans text-xs leading-relaxed text-gray-600 dark:text-gray-400">
          Groundsure supply the extras individually — environmental, flood, planning, and mining
          searches such as the CON29M coal report — added on top of whichever pack you choose.
          They do not carry out local authority searches.
        </p>
        {comparisons.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-gray-200 pt-2 dark:border-[#1E2A3A]">
            {comparisons.map((comparison) => (
              <li
                key={comparison.bundleId}
                className="font-dm-sans text-xs text-gray-700 dark:text-gray-300"
              >
                {comparison.bundleName} {pounds(comparison.bundlePence)} ·{' '}
                {pounds(comparison.singlesPence)} bought individually ·{' '}
                {comparison.savingPence >= 0
                  ? `bundle saves ${pounds(comparison.savingPence)}`
                  : `individually saves ${pounds(comparison.savingPence)}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to={GUIDE_PATH}
        className="inline-block font-dm-sans text-xs font-medium text-[#5F8A68] underline"
      >
        Read what each search actually tells you
      </Link>
    </div>
  );
}
