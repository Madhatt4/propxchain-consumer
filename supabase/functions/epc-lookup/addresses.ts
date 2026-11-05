/**
 * Address list for a postcode, built from EPC register search rows.
 *
 * Why the EPC register: it is the one free source we already hold that lists
 * individual dwellings on a postcode together with their UPRN. The UPRN is
 * what lets the property check drop its pin on the house itself instead of the
 * postcode's centre. Its limit is coverage: a home that has never had an EPC
 * is not on it, so callers must always offer a typed-address fallback.
 */

export interface AddressSearchRow {
  uprn?: string | number | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
}

export interface AddressOption {
  /** What the visitor sees in the list, e.g. "Flat 2, 10 High Street". */
  label: string;
  /** EPC addressLine1, used to match the certificate for this home. */
  line1: string;
  /** 1-12 digit UPRN, or null when the register row had none. */
  uprn: string | null;
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** A UPRN is digits only; anything else is treated as absent, never guessed. */
export function normaliseUprn(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return /^\d{1,12}$/.test(s) ? s : null;
}

/**
 * One entry per home: a dwelling with several certificates appears once.
 * Rows are keyed by UPRN when present, otherwise by their address text.
 */
export function buildAddressList(rows: AddressSearchRow[]): AddressOption[] {
  const seen = new Map<string, AddressOption>();
  for (const row of rows) {
    const line1 = clean(row.addressLine1);
    if (!line1) continue;
    const label = [line1, clean(row.addressLine2)].filter(Boolean).join(', ');
    const uprn = normaliseUprn(row.uprn);
    const key = uprn ? `u:${uprn}` : `a:${label.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, { label, line1, uprn });
  }
  return [...seen.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'en-GB', { numeric: true, sensitivity: 'base' }),
  );
}
