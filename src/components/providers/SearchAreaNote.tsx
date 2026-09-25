// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tells the customer how the search area was worked out — but only when it is
 * not the property's own boundary.
 *
 * Searches are area-based: whatever polygon we send is the land the provider
 * assesses. When we resolve the property's registered freehold parcel there is
 * nothing to explain, so this renders nothing. When we fall back to a square box
 * the reports may not line up with the plot, and that is worth one quiet line
 * before they pay rather than a surprise afterwards.
 */

import type { BoundarySource } from '../../services/propertyBoundary.service';

interface SearchAreaNoteProps {
  /** How the boundary was derived, or null while it is still resolving. */
  source: BoundarySource | null;
  /** Half-side of the fallback box in metres, so the copy matches what we sent. */
  halfSizeMetres: number | null;
}

export default function SearchAreaNote({
  source,
  halfSizeMetres,
}: SearchAreaNoteProps): JSX.Element | null {
  // The good path needs no explanation: the search area IS the property.
  if (!source || source === 'inspire-polygon') return null;

  const sideMetres = halfSizeMetres ? halfSizeMetres * 2 : null;
  const square = sideMetres ? `${sideMetres}m square` : 'small square';

  const detail =
    source === 'uprn-centroid'
      ? `We have matched this property's exact address point, but HM Land Registry does not publish a registered boundary we can pair with it. Searches will cover a ${square} centred on the property.`
      : `We could not match this property to its own boundary or address point, so searches will cover a ${square} centred on the postcode. On a long street that may not line up with the plot.`;

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30"
      data-testid="search-area-note"
    >
      <p className="font-dm-sans text-xs text-amber-900 dark:text-amber-200">
        <span className="font-semibold">How we worked out the search area.</span> {detail} If the
        reports look wrong for this address, tell your conveyancer before you rely on them.
      </p>
    </div>
  );
}
