/**
 * Display tidying for the property check's address picker.
 *
 * The EPC register is written by thousands of assessors, so one street reads
 * "4, North Parade", "72 North Parade" and "7B IVEL ROAD" side by side. This
 * changes only what the visitor reads. The register's own line1 is left alone
 * because the edge function matches the home's certificate against it.
 */

import type { PostcodeAddress } from '@/services/epc.service';

const HOUSE_NUMBER = /^\d+[a-z]?$/i;

/** Lower-cases everything, then capitalises each word, including hyphenated parts. */
function titleCase(part: string): string {
  return part.toLowerCase().replace(/(^|[\s\-(/])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** "7B" and "7a" in one list read as a typo, so the letter after a number is lower-cased. */
function lowerHouseLetter(part: string): string {
  return part.replace(/\b(\d+)([A-Z])\b/g, (_m, num: string, letter: string) => num + letter.toLowerCase());
}

export function tidyAddressLabel(label: string): string {
  const isShouting = /[A-Z]/.test(label) && !/[a-z]/.test(label);
  const parts = label
    .split(',')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((p) => lowerHouseLetter(isShouting ? titleCase(p) : p));

  // A part that is only a house number belongs to the street after it: "4, North Parade" -> "4 North Parade".
  const joined: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const next = parts[i + 1];
    if (next !== undefined && HOUSE_NUMBER.test(part)) {
      parts[i + 1] = `${part} ${next}`;
      continue;
    }
    joined.push(part);
  }
  return joined.join(', ');
}

/** Tidies every label and re-sorts, since tidying can change the order. */
export function tidyAddressList(list: PostcodeAddress[]): PostcodeAddress[] {
  return list
    .map((a) => ({ ...a, label: tidyAddressLabel(a.label) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en-GB', { numeric: true, sensitivity: 'base' }));
}
