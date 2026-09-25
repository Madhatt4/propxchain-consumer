// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Sales-pack readiness — the meter behind the Sales pack tab and the
 * Overview chip (decisions: Madhatt4/Propxchain#115).
 *
 * A pack is a simple fraction of binary items, unweighted. TA7 counts only
 * when the transaction could be leasehold (mirrors the forms stage: unknown
 * or missing tenure keeps TA7 visible rather than wrongly hiding it).
 *
 * The loader normalises the sources' inconsistent failure modes (some throw,
 * some return null/[]): any source failing reads as "not done", never as an
 * error — the meter must render on a flaky connection.
 *
 * Known blind spots, inherited from the sources and accepted on the ticket:
 * a TA form completed by PDF upload (recordFormUpload) is not queryable, so
 * it reads not-done here; "searches back" is only observable for OneSearch
 * orders (other providers never report results server-side).
 */
import type { PropertyListing, Tenure } from '@/types/listing.types';
import { syncListingFromChain, getTitleNumber } from '@/utils/rightmoveStorage';
import { hmlrTitleService } from './hmlrTitle.service';
import { searchOrderService } from './searchOrder.service';
import { fetchReturnedOneSearchResults } from './onesearchResults';
import { documentShareService } from './documentShare.service';
import { icpService } from './icp.service';
import { enrichAndStoreListing } from './listingEnrichment';
import { enrichListingFromRegisters, type FactDiscrepancy } from './listingFactsFromRegister';

export type PackItemId =
  | 'materialInfo'
  | 'epc'
  | 'titlePulled'
  | 'searchesOrdered'
  | 'searchesBack'
  | 'ta6'
  | 'ta10'
  | 'ta7'
  | 'idShared';

export interface PackItem {
  id: PackItemId;
  label: string;
  done: boolean;
}

export interface PackReadiness {
  items: PackItem[];
  done: number;
  total: number;
  /** Register values that contradict the listing; shown, never auto-resolved. */
  warnings: string[];
}

export interface PackReadinessInputs {
  listing: PropertyListing | null;
  titlePulled: boolean;
  searchesOrdered: boolean;
  searchesBack: boolean;
  ta6: boolean;
  ta10: boolean;
  ta7: boolean;
  idShared: boolean;
  registerDiscrepancies: FactDiscrepancy[];
}

/** Vault slots whose sharing satisfies the "seller ID docs shared" item. */
const ID_SLOT_IDS = ['amlSourceOfFunds', 'proofOfId'];

/**
 * The listing's disclosure set is complete: price, a committed tenure,
 * property type and council tax band — plus the cost trio when leasehold.
 * EPC is deliberately excluded: it is its own meter item.
 */
export function isMaterialInfoComplete(listing: PropertyListing | null): boolean {
  if (!listing) return false;
  const hasCore =
    listing.address.trim().length > 0 &&
    listing.postcode.trim().length > 0 &&
    listing.price > 0 &&
    listing.tenure !== 'unknown' &&
    listing.propertyType.trim().length > 0 &&
    (listing.councilTaxBand ?? '').trim().length > 0;
  if (!hasCore) return false;
  if (listing.tenure !== 'leasehold') return true;
  return (
    (listing.leaseYearsRemaining ?? 0) > 0 &&
    listing.groundRentPerYear != null &&
    listing.serviceChargePerYear != null
  );
}

/** Mirrors the forms stage: TA7 hidden only when tenure rules leasehold out. */
function includesTa7(tenure: Tenure | null | undefined): boolean {
  return tenure !== 'freehold' && tenure !== 'shareOfFreehold';
}

export function computePackReadiness(inputs: PackReadinessInputs): PackReadiness {
  const items: PackItem[] = [
    { id: 'materialInfo', label: 'Material information complete', done: isMaterialInfoComplete(inputs.listing) },
    { id: 'epc', label: 'EPC rating on the listing', done: (inputs.listing?.epcRating ?? '').trim().length > 0 },
    { id: 'titlePulled', label: 'Title register pulled (HMLR)', done: inputs.titlePulled },
    { id: 'searchesOrdered', label: 'Property searches ordered', done: inputs.searchesOrdered },
    { id: 'searchesBack', label: 'Search results back', done: inputs.searchesBack },
    { id: 'ta6', label: 'TA6 property information form', done: inputs.ta6 },
    { id: 'ta10', label: 'TA10 fittings and contents form', done: inputs.ta10 },
    ...(includesTa7(inputs.listing?.tenure)
      ? [{ id: 'ta7' as const, label: 'TA7 leasehold information form', done: inputs.ta7 }]
      : []),
    { id: 'idShared', label: 'Proof of ID shared from your wallet (never inside the pack)', done: inputs.idShared },
  ];
  return {
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    warnings: (inputs.registerDiscrepancies ?? []).map(describeDiscrepancy),
  };
}

const FIELD_LABEL: Record<FactDiscrepancy['field'], string> = {
  tenure: 'Tenure',
  postcode: 'Postcode',
};

function describeDiscrepancy(d: FactDiscrepancy): string {
  return `${FIELD_LABEL[d.field]}: the HMLR register says "${d.register}" but the listing says "${d.listing}". Check which is right before sharing the pack.`;
}

async function swallow<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch {
    return fallback;
  }
}

/** True when a completed HMLR pull exists for this transaction or its title. */
async function checkTitlePulled(transactionId: string): Promise<boolean> {
  const register = await swallow(
    hmlrTitleService.getStoredRegisterForTransaction(transactionId),
    null,
  );
  if (register) return true;
  const titleNumber = getTitleNumber(transactionId);
  if (!titleNumber) return false;
  const row = await swallow(hmlrTitleService.findPullByTitleNumber(titleNumber), null);
  return row != null;
}

/**
 * Statuses on a `search_orders` row that mean searches were actually ordered.
 *
 * A row is written when checkout opens, before anyone has paid, so its mere
 * existence proves nothing: `requested` means the payment is unconfirmed, and
 * `abandoned` means it never came (monorepo #230's sweep sets it once the
 * Stripe session can no longer be paid). `failed` means the order did not
 * reach the supplier. Counting any of those as "ordered" tells a seller their
 * pack is further along than it is, which is the same overstatement the
 * pre-payment audit row used to make.
 */
const ORDERED_SEARCH_STATUSES: readonly string[] = ['ordered', 'in_progress', 'completed'];

/** Any evidence of an order: a paid commerce row, or the searches_ordered event. */
async function checkSearchesOrdered(transactionId: string): Promise<boolean> {
  const orders = await swallow(searchOrderService.getOrdersForTransaction(transactionId), []);
  if (orders.some((o) => ORDERED_SEARCH_STATUSES.includes(o.status))) return true;
  const events = await swallow(
    (async () => {
      const raw = await icpService.ledgerManager?.getEventsByTransaction(transactionId);
      return (raw ?? []) as Array<{ eventType?: string }>;
    })(),
    [] as Array<{ eventType?: string }>,
  );
  return events.some((e) => e.eventType === 'searches_ordered');
}

async function checkIdShared(transactionId: string): Promise<boolean> {
  const grants = await swallow(documentShareService.listMyGrants(transactionId), []);
  return grants.some(
    (g) => g.status === 'active' && g.slotId != null && ID_SLOT_IDS.includes(g.slotId),
  );
}

/**
 * Gather all inputs for a transaction. Every source is individually
 * failure-isolated; the listing itself comes from the localStorage-first
 * chain sync so the meter agrees with the flow page.
 */
export async function loadPackReadinessInputs(
  transactionId: string,
): Promise<PackReadinessInputs> {
  const stored = await swallow(syncListingFromChain(transactionId), null);
  // Stage 0 is where the pack is assembled, so this is where free public
  // records (EPC register) fill the blanks a portal import leaves - the
  // seller should not have to open Stage 1 for "EPC rating" to complete.
  const withEpc = stored ? await swallow(enrichAndStoreListing(transactionId, stored), stored) : null;
  // Registers next: the paid HMLR register (tenure, address) or, failing
  // that, the free price-paid tenure. Clashes come back as warnings.
  const facts = withEpc
    ? await swallow(enrichListingFromRegisters(transactionId, withEpc), { listing: withEpc, changed: false, discrepancies: [] })
    : null;
  const listing = facts?.listing ?? null;
  const registerDiscrepancies = facts?.discrepancies ?? [];
  const [titlePulled, searchesOrdered, searchesBack, ta6, ta10, ta7, idShared] =
    await Promise.all([
      checkTitlePulled(transactionId),
      checkSearchesOrdered(transactionId),
      swallow(
        fetchReturnedOneSearchResults(transactionId).then((r) => r.length > 0),
        false,
      ),
      swallow(icpService.getTA6(transactionId).then((f) => f != null), false),
      swallow(icpService.getTA10(transactionId).then((f) => f != null), false),
      swallow(icpService.getTA7(transactionId).then((f) => f != null), false),
      checkIdShared(transactionId),
    ]);
  return { listing, titlePulled, searchesOrdered, searchesBack, ta6, ta10, ta7, idShared, registerDiscrepancies };
}

export async function loadPackReadiness(transactionId: string): Promise<PackReadiness> {
  return computePackReadiness(await loadPackReadinessInputs(transactionId));
}
