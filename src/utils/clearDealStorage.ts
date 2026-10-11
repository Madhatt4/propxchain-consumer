// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Deal data the app caches in localStorage: form drafts (TA6/TA7/TA10),
 * conveyancer document lists, KYC state, postcodes, document id maps. None of
 * it is scoped to the signed-in user, so on a shared computer the next person
 * to sign in could read the last one's deal (security scan L8). Logout wipes
 * it; unsaved drafts are lost at that point, which is the expected trade.
 *
 * Logout is not the only way accounts change hands on one browser: a session
 * can expire and a different account sign in with no logout in between
 * (2026-10-10: a second account opened a deal page dressed with the first
 * account's cached listing). So the signed-in principal is remembered too,
 * and a sign-in under a different principal wipes the same keys.
 */

const DEAL_KEY_PREFIXES = [
  'txflow:',
  'ta6_',
  'ta7_',
  'ta10_',
  'conveyancer_docs_',
  'conveyancer_txs_',
  'propx_kyc_',
  'tx_postcode_',
  'transactionTier_',
  'doc_id_mapping_',
] as const;

const DEAL_KEYS = [
  'web2_documents',
  'propxchain_property_searches',
  'propxchain_search_signoffs',
  'propxchain_acknowledged_docs',
  'txPartyCount',
  // The deal page's listing panel and title numbers, keyed by transaction id
  // (utils/rightmoveStorage). Public data, but still another account's deal.
  'rightmoveListings',
  'propertyTitleNumbers',
] as const;

/** Who was signed in last on this browser. Not deal data itself, so never wiped by the purge. */
export const LAST_PRINCIPAL_KEY = 'propxchain-last-principal';

export function isDealStorageKey(key: string): boolean {
  return (
    DEAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
    (DEAL_KEYS as readonly string[]).includes(key)
  );
}

/** Removes every deal-data key; iterates backwards because removal reindexes. */
export function clearDealStorage(storage: Storage = localStorage): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key && isDealStorageKey(key)) storage.removeItem(key);
  }
}

/**
 * Call on every sign-in with the principal that just signed in. When a
 * different principal was signed in before on this browser, the previous
 * account's deal data is wiped first. Returns true when a wipe happened.
 * Storage that cannot be read (private window, blocked site data) is
 * treated as a first sign-in.
 */
export function rememberSignedInPrincipal(principalId: string, storage: Storage = localStorage): boolean {
  let previous: string | null = null;
  try {
    previous = storage.getItem(LAST_PRINCIPAL_KEY);
  } catch {
    previous = null;
  }
  const changed = previous !== null && previous !== principalId;
  if (changed) clearDealStorage(storage);
  try {
    storage.setItem(LAST_PRINCIPAL_KEY, principalId);
  } catch {
    // Nothing to remember into; the next sign-in is judged as a first one.
  }
  return changed;
}
