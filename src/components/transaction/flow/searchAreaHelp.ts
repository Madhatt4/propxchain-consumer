import {
  DEFAULT_HALF_SIZE_METRES,
  type BoundarySource,
} from '../../../services/propertyBoundary.service';

/** How the search area resolved for the current property. */
export interface SearchAreaInfo {
  source: BoundarySource;
  /** Half-side of the fallback square in metres; null when the real boundary was used. */
  halfSizeMetres: number | null;
}

/** Stages whose help explains how the search area is worked out. */
export const SEARCH_AREA_STAGE_ID = 'seller-2';

export const SEARCH_AREA_HEADING = 'How we work out the search area';

/** Side of the fallback square, taken from the value the resolver uses. */
const DEFAULT_SIDE_METRES = DEFAULT_HALF_SIZE_METRES * 2;

/** The method, in the order the code tries it. */
export const SEARCH_AREA_METHOD: readonly string[] = [
  "Searches cover an area, so the area we send decides what the reports describe. We first try your property's own registered boundary from HM Land Registry.",
  'If there is no boundary we can match, we use the exact address point of the property and draw a small square around it.',
  `If neither matches, we draw a square (${DEFAULT_SIDE_METRES} m across) centred on the postcode. On a long street that may not line up with your plot.`,
  'If the reports look wrong for the address, tell your conveyancer before you rely on them.',
];

/**
 * The property-specific line, shown only when the area is not the property's
 * own boundary. Same condition the old amber note used.
 */
export function searchAreaFallbackLine(area: SearchAreaInfo | null): string | null {
  if (!area || area.source === 'inspire-polygon') return null;
  const side = area.halfSizeMetres ? `${area.halfSizeMetres * 2} m square` : 'small square';
  return area.source === 'uprn-centroid'
    ? `For this property we matched the exact address point, but HM Land Registry does not publish a registered boundary we can pair with it, so your searches will cover a ${side} centred on the property.`
    : `For this property we could not match its own boundary or address point, so your searches will cover a ${side} centred on the postcode.`;
}
