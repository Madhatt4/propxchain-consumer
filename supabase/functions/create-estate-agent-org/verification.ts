/**
 * Companies House trust decision for create-estate-agent-org.
 *
 * WHY this is a separate pure module: the old inline logic set verified=true
 * for any active company number while storing the client's free-text name,
 * so anyone could create "Foxtons" with Foxtons' real number and get the
 * verified badge. It also stored the client's own companies_house_data as the
 * snapshot whenever the server lookup failed. Both are trust decisions, so
 * they live here where they can be tested without a network.
 *
 * Rules:
 *   - Only the server's own lookup can make an org verified.
 *   - A verified org is stored under the REGISTERED name from that lookup,
 *     never the typed name, so the badge always sits next to the name
 *     Companies House holds for that number.
 *   - A client-supplied snapshot is never stored. No server data, no snapshot.
 */

export interface CompaniesHouseCompany {
  companyNumber: string;
  name: string;
  status: string;
  incorporatedOn: string;
  address: Record<string, string | undefined>;
  isActive: boolean;
}

export type CompaniesHouseDecision =
  | { kind: 'dissolved' }
  | {
    kind: 'create';
    name: string;
    verified: boolean;
    snapshot: CompaniesHouseCompany | null;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Validates the companies-house-lookup response. Anything malformed, nameless
 * or for a different company number than we asked about is treated as a
 * failed lookup, so it can never produce a verified org.
 */
export function parseServerCompany(
  raw: unknown,
  requestedNumber: string,
): CompaniesHouseCompany | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const companyNumber = typeof raw.companyNumber === 'string'
    ? raw.companyNumber.trim().toUpperCase()
    : '';
  if (!name || name.length > 200) return null;
  if (companyNumber !== requestedNumber) return null;
  if (typeof raw.isActive !== 'boolean') return null;

  const address: Record<string, string | undefined> = {};
  if (isRecord(raw.address)) {
    for (const [k, v] of Object.entries(raw.address)) {
      if (typeof v === 'string') address[k] = v;
    }
  }

  return {
    companyNumber,
    name,
    status: stringOr(raw.status, ''),
    incorporatedOn: stringOr(raw.incorporatedOn, ''),
    address,
    isActive: raw.isActive,
  };
}

/**
 * Decide what to store. `serverCh` is the parsed result of OUR lookup, or
 * null when no number was given or the lookup failed.
 */
export function decideCompaniesHouse(
  clientName: string,
  serverCh: CompaniesHouseCompany | null,
): CompaniesHouseDecision {
  if (!serverCh) {
    return { kind: 'create', name: clientName, verified: false, snapshot: null };
  }
  if (!serverCh.isActive) return { kind: 'dissolved' };
  return { kind: 'create', name: serverCh.name, verified: true, snapshot: serverCh };
}
