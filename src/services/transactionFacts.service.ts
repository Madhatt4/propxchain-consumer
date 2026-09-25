// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Seed `transaction_facts` from the listing (audit gaps G3 + G6).
 *
 * The conveyancer quote scope and the conveyancer brief both read
 * `transaction_facts` (property_type, declared_tenure) to decide which work
 * items apply, but nothing on the client ever wrote that table: the
 * onboarding questions it was designed for were never built, so the brief
 * composed with no facts at all. The listing already knows both answers.
 *
 * One row per (transaction, user) under RLS, so this writes the caller's own
 * row and only fills columns that are still null. A fact the party answered
 * themselves is never overwritten.
 */
import { supabase } from '../lib/supabase';
import type { PropertyListing } from '@/types/listing.types';
import { logger } from '@/utils/logger';

export interface TransactionFactsFromListing {
  property_type: 'flat' | 'house' | null;
  declared_tenure: 'Leasehold' | 'Freehold' | null;
}

const FLAT_WORDS = /\b(flat|apartment|maisonette|penthouse|studio|duplex)\b/i;

/** The two facts the listing can state, in the table's own vocabulary. */
export function factsFromListing(listing: PropertyListing | null): TransactionFactsFromListing {
  if (!listing) return { property_type: null, declared_tenure: null };
  const type = (listing.propertyType ?? '').trim();
  const property_type = !type ? null : FLAT_WORDS.test(type) ? 'flat' : 'house';
  const declared_tenure =
    listing.tenure === 'freehold' ? 'Freehold'
    : listing.tenure === 'leasehold' || listing.tenure === 'shareOfFreehold' ? 'Leasehold'
    : null;
  return { property_type, declared_tenure };
}

/** Human label for the quote request email, or undefined when unknown. */
export function tenureLabel(listing: PropertyListing | null): string | undefined {
  const t = factsFromListing(listing).declared_tenure;
  if (!t) return undefined;
  return listing?.tenure === 'shareOfFreehold' ? 'Share of freehold' : t;
}

/**
 * Fill the caller's null facts from the listing. Returns the columns
 * written, or an empty object when nothing was needed or possible.
 */
export async function seedTransactionFactsFromListing(
  transactionId: string,
  listing: PropertyListing | null,
): Promise<Partial<TransactionFactsFromListing>> {
  const facts = factsFromListing(listing);
  if (!facts.property_type && !facts.declared_tenure) return {};

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return {};

  const { data: existing } = await supabase
    .from('transaction_facts')
    .select('property_type, declared_tenure')
    .eq('transaction_id', transactionId)
    .eq('user_id', userId)
    .maybeSingle();

  const patch: Partial<TransactionFactsFromListing> = {};
  if (facts.property_type && !existing?.property_type) patch.property_type = facts.property_type;
  if (facts.declared_tenure && !existing?.declared_tenure) patch.declared_tenure = facts.declared_tenure;
  if (Object.keys(patch).length === 0) return {};

  const { error } = await supabase
    .from('transaction_facts')
    .upsert({ transaction_id: transactionId, user_id: userId, ...patch }, { onConflict: 'transaction_id,user_id' });
  if (error) {
    logger.warn('[facts] could not seed transaction_facts from the listing', error.message);
    return {};
  }
  return patch;
}
