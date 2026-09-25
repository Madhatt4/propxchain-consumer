import type { RightmovePropertyListing } from '@/types/rightmove.types';
import { icpService } from '@/services/icp.service';
import { recordOnBehalf } from '@/services/onBehalf';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'rightmoveListings';

interface RightmoveStore {
  [transactionId: string]: RightmovePropertyListing;
}

function getStore(): RightmoveStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Outcome of the on-chain listing write. `ok: false` means the listing is
 *  saved in localStorage but did NOT reach the chain — so it may not survive a
 *  device change or be visible to the buyer until re-saved. */
export interface ChainPersistResult {
  ok: boolean;
  error?: string;
}

export function storeRightmoveData(
  transactionId: string,
  listing: RightmovePropertyListing
): Promise<ChainPersistResult> {
  const store = getStore();
  store[transactionId] = listing;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  logger.warn(`[RM] Stored listing locally for ${transactionId}, persisting to chain...`);

  // Persist to chain. Resolve to a result object (never reject) so callers can
  // surface a failure without risking an unhandled rejection — the seller's data
  // is already safe in localStorage; it's the on-chain write that may have failed.
  return icpService.setListingData(transactionId, listing as unknown as Record<string, unknown>)
    .then((): ChainPersistResult => {
      logger.warn(`[RM] ✅ Listing persisted to chain for ${transactionId}`);
      void recordOnBehalf(transactionId, 'seller', 'fill_pack_form', 'listing');
      return { ok: true };
    })
    .catch((err: unknown): ChainPersistResult => {
      const error = err instanceof Error ? err.message : String(err);
      logger.warn(`[RM] ❌ Failed to persist listing to chain for ${transactionId}:`, error);
      return { ok: false, error };
    });
}

export function getRightmoveData(
  transactionId: string
): RightmovePropertyListing | null {
  const store = getStore();
  return store[transactionId] || null;
}

export function removeRightmoveData(transactionId: string): void {
  const store = getStore();
  delete store[transactionId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Sync listing data from on-chain storage into localStorage cache.
 * Only fetches from chain if localStorage doesn't already have data.
 */
export async function syncListingFromChain(
  transactionId: string
): Promise<RightmovePropertyListing | null> {
  const cached = getRightmoveData(transactionId);
  if (cached) return cached;

  logger.warn(`[RM] Syncing listing from chain for ${transactionId}...`);

  try {
    const chainData = await icpService.getListingData(transactionId);
    if (chainData) {
      logger.warn(`[RM] ✅ Got listing from chain for ${transactionId}`);
      const listing = chainData as unknown as RightmovePropertyListing;
      const store = getStore();
      store[transactionId] = listing;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return listing;
    }
    logger.warn(`[RM] ⚠️ No listing data on chain for ${transactionId}`);
  } catch (err) {
    logger.warn(`[RM] ❌ Failed to sync listing from chain for ${transactionId}:`, err);
  }
  return null;
}

const TITLE_STORAGE_KEY = 'propertyTitleNumbers';

interface TitleStore {
  [transactionId: string]: string;
}

function getTitleStore(): TitleStore {
  try {
    const raw = localStorage.getItem(TITLE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function storeTitleNumber(transactionId: string, titleNumber: string): void {
  const store = getTitleStore();
  store[transactionId] = titleNumber;
  localStorage.setItem(TITLE_STORAGE_KEY, JSON.stringify(store));
}

export function getTitleNumber(transactionId: string): string | null {
  const store = getTitleStore();
  return store[transactionId] || null;
}

function normalisePostcode(value: string | undefined | null): string {
  return (value || '').toUpperCase().replace(/\s+/g, '');
}

/**
 * Move pending Rightmove listing (from pre-Stripe flow) to a transaction ID.
 * Call this from PaymentSuccessPage after transaction creation.
 *
 * `expected` is the property the transaction was actually created for. The
 * stashed listing is attached ONLY if it is for that same property.
 *
 * Why the check exists: `pendingRightmoveListing` is a single global slot.
 * CreateTransactionPage wrote it only when the new transaction had a listing,
 * and never cleared it otherwise — so a listing left behind by an abandoned or
 * earlier checkout stayed put and was claimed by the next transaction to
 * complete. The result was a real listing (photos, address, price) attached to
 * an unrelated property: the dashboard card showed the correct address from
 * chain while opening the transaction showed a different house entirely.
 *
 * The write side is fixed too, but this check has to stay: browsers already
 * carry poisoned slots from the old behaviour, and this is the only place that
 * can stop those landing on a transaction.
 */
export function claimPendingRightmoveData(
  transactionId: string,
  expected?: { address?: string; postcode?: string }
): void {
  const raw = localStorage.getItem('pendingRightmoveListing');
  if (!raw) return;

  try {
    const listing: RightmovePropertyListing = JSON.parse(raw);

    // Postcode is the reliable discriminator — a real import always carries
    // one. When both sides have one they must agree; a mismatch means this
    // listing belongs to a different transaction and must not be attached.
    // When either is missing we cannot tell, so we keep the old behaviour
    // rather than silently dropping a legitimate listing.
    const want = normalisePostcode(expected?.postcode);
    const got = normalisePostcode(listing.postcode);
    if (want && got && want !== got) {
      logger.warn(
        `[RM] Discarding stale pending listing (${got}) — transaction ${transactionId} is ${want}`
      );
      localStorage.removeItem('pendingRightmoveListing');
      return;
    }

    storeRightmoveData(transactionId, listing);
    localStorage.removeItem('pendingRightmoveListing');
  } catch {
    // Silently fail — non-critical feature
  }
}

/** Drop any stashed listing. Called when a checkout starts WITHOUT one, so the
 *  next completed transaction cannot inherit an earlier property's listing. */
export function clearPendingRightmoveData(): void {
  localStorage.removeItem('pendingRightmoveListing');
}
