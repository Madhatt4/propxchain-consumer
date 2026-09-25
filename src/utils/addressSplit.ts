/**
 * Heuristic split of a single-line UK address into structured fields.
 * Used to seed the manual entry form after a URL import — the listing
 * scrapers return a flat string, but the form wants structured pieces.
 *
 * The split is best-effort. The user can correct any field on save.
 *
 * Strategy:
 *  1. Pull a UK postcode out of the string with a regex (matches both
 *     full and partial outward codes, e.g. "SG19 1AB", "EC1A 1BB").
 *  2. Strip it from the string and split the remainder on commas.
 *  3. Map the remaining parts onto line1 / line2 / town / county based on
 *     position. Heuristics here:
 *       - 1 part → line1
 *       - 2 parts → line1, town
 *       - 3 parts ending in a county → line1, town, county (Rightmove's
 *         "Street, Town, County" shape — previously the county landed in
 *         the town field, seen live 2026-07-22)
 *       - 3 parts otherwise → line1, line2, town
 *       - 4+ parts → line1, line2, town, county (county = penultimate)
 */

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i;

/** Ceremonial/postal county names that don't end in "shire". Anything ending
 *  in "shire" is treated as a county without needing to be listed. */
const NON_SHIRE_COUNTIES = new Set([
  'cornwall', 'cumbria', 'devon', 'dorset', 'somerset', 'essex', 'kent',
  'surrey', 'norfolk', 'suffolk', 'rutland', 'merseyside', 'cleveland',
  'east sussex', 'west sussex', 'county durham', 'tyne and wear',
  'west midlands', 'greater london', 'greater manchester', 'isle of wight',
  'north yorkshire', 'south yorkshire', 'west yorkshire', 'east riding of yorkshire',
]);

function isCounty(part: string): boolean {
  const lower = part.toLowerCase();
  return lower.endsWith('shire') || NON_SHIRE_COUNTIES.has(lower);
}

export interface AddressParts {
  line1: string;
  line2?: string;
  town?: string;
  county?: string;
  postcode?: string;
}

export function splitAddress(input: string | null | undefined): AddressParts {
  if (!input) return { line1: '' };

  const postcodeMatch = input.match(UK_POSTCODE_RE);
  const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase().replace(/\s+/, ' ').trim() : undefined;

  const withoutPostcode = postcode
    ? input.replace(UK_POSTCODE_RE, '').replace(/,\s*$/, '').trim()
    : input.trim();

  const parts = withoutPostcode
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) return { line1: '', postcode };
  if (parts.length === 1) return { line1: parts[0], postcode };
  if (parts.length === 2) return { line1: parts[0], town: parts[1], postcode };
  if (parts.length === 3) {
    if (isCounty(parts[2])) {
      return { line1: parts[0], town: parts[1], county: parts[2], postcode };
    }
    return { line1: parts[0], line2: parts[1], town: parts[2], postcode };
  }
  return {
    line1: parts[0],
    line2: parts.slice(1, -2).join(', '),
    town: parts[parts.length - 2],
    county: parts[parts.length - 1],
    postcode,
  };
}

/**
 * Inverse of splitAddress — joins structured fields back into a single
 * display string. Used when the user saves the manual form so the
 * canonical `address` stays in sync with the structured pieces.
 */
export function joinAddress(parts: AddressParts): string {
  const segments = [parts.line1, parts.line2, parts.town, parts.county, parts.postcode]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return segments.join(', ');
}
