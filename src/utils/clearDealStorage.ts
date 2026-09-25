// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Deal data the app caches in localStorage: form drafts (TA6/TA7/TA10),
 * conveyancer document lists, KYC state, postcodes, document id maps. None of
 * it is scoped to the signed-in user, so on a shared computer the next person
 * to sign in could read the last one's deal (security scan L8). Logout wipes
 * it; unsaved drafts are lost at that point, which is the expected trade.
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
] as const;

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
