// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * tmGroup's six quoted packs, offered as preset baskets above the build-your-own
 * list. Prices come from the live per-property quote, never from the pack sheet.
 */

import { priceLabel } from './tmGroupCardHelpers';

import type { ResolvedTmGroupPack } from '../../services/tmGroupPacks';

interface TmGroupPackPickerProps {
  packs: ResolvedTmGroupPack[];
  /** null = build your own, the card's original behaviour. */
  selectedPackId: string | null;
  onSelect: (packId: string | null) => void;
  /** Gross pence per tmGroup product code, from the live catalogue quote. */
  linePence: Map<string, number>;
  /** Codes tmGroup could not price for this property. */
  unpriceable: Set<string>;
}

/**
 * A pack's price for THIS property: the sum of its lines as tmGroup quoted them.
 *
 * Returns null when any line is missing or unpriceable, so the row shows "—"
 * rather than a total that silently omits a search the customer is buying.
 */
function packPence(
  pack: ResolvedTmGroupPack,
  linePence: Map<string, number>,
  unpriceable: Set<string>,
): number | null {
  if (!pack.isAvailable) return null;
  if (pack.orderCodes.some((code) => unpriceable.has(code))) return null;
  // A code the quote has not returned is not the same as a code priced at zero.
  // Summing `?? 0` across a partial quote produces a real-looking total that is
  // too low, which is worse than showing nothing because it reads as a price.
  // Yoda, PR #261.
  if (pack.orderCodes.some((code) => !linePence.has(code))) return null;

  return pack.orderCodes.reduce((sum, code) => sum + (linePence.get(code) ?? 0), 0);
}

export default function TmGroupPackPicker({
  packs,
  selectedPackId,
  onSelect,
  linePence,
  unpriceable,
}: TmGroupPackPickerProps): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        tmGroup packs
      </p>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {packs.map((pack) => {
          const total = packPence(pack, linePence, unpriceable);
          const isSelected = selectedPackId === pack.id;

          return (
            <div key={pack.id} className="px-4 py-3">
              <label
                className={`flex items-start justify-between gap-3 ${
                  pack.isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="tmgroup-pack"
                    className="mt-1 h-4 w-4 flex-shrink-0"
                    checked={isSelected}
                    disabled={!pack.isAvailable}
                    onChange={() => onSelect(pack.id)}
                  />
                  <span>
                    <span className="block text-sm text-gray-800 dark:text-gray-200">{pack.name}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{pack.tagline}</span>
                    {pack.excludesAuthorityFees && (
                      <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                        Council and water authority fees are charged on top at cost — they vary by
                        council and are included in the total below once we have priced your property.
                      </span>
                    )}
                    {!pack.isAvailable && (
                      <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                        Not available yet — we are waiting on tmGroup to confirm{' '}
                        {pack.missingCodes.join(', ')}.
                      </span>
                    )}
                  </span>
                </span>
                <span className="whitespace-nowrap font-mono tabular-nums text-sm text-gray-600 dark:text-gray-400">
                  {total === null ? '—' : priceLabel(total)}
                </span>
              </label>
            </div>
          );
        })}

        <div className="px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="tmgroup-pack"
              className="h-4 w-4 flex-shrink-0"
              checked={selectedPackId === null}
              onChange={() => onSelect(null)}
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">
              Build your own — choose each search below
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
