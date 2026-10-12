// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * When the buyer's mortgage offer runs out, against today. The date is the
 * one the buyer confirmed on the funding stage (read from the offer, checked
 * by them), carried in the Buyer Pack's mortgage detail so every party on the
 * deal reads the same thing.
 *
 * Warn with a month to go: an extension or a fresh offer takes the lender
 * weeks, and completing on a lapsed offer is not possible.
 */
import type { BuyerPackItem } from './buyerPack.service';

export const OFFER_WARNING_DAYS = 30;
const DAY_MS = 86_400_000;

export type OfferExpiryState = 'ok' | 'soon' | 'expired';

export interface OfferExpiry {
  state: OfferExpiryState;
  /** YYYY-MM-DD, the last day the offer can be used. */
  expiresOn: string;
  /** Whole days from today to the expiry day; negative once it has passed. */
  daysLeft: number;
}

/** UTC midnight of a YYYY-MM-DD, or null if it is not one. */
function dayStart(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t;
}

export function offerExpiryFromPack(items: BuyerPackItem[] | null | undefined, now: number): OfferExpiry | null {
  const d = items?.find((i) => i.item === 'mortgage')?.detail;
  const expiresOn = d?.offer_expires_on;
  if (!expiresOn) return null;
  const expiry = dayStart(expiresOn);
  if (expiry === null) return null;
  const today = new Date(now);
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  // The offer can still be used on its expiry day itself.
  const daysLeft = Math.round((expiry - todayStart) / DAY_MS);
  const state: OfferExpiryState = daysLeft < 0 ? 'expired' : daysLeft <= OFFER_WARNING_DAYS ? 'soon' : 'ok';
  return { state, expiresOn, daysLeft };
}

export function formatOfferDate(iso: string): string {
  const t = dayStart(iso);
  if (t === null) return iso;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function describeOfferExpiry(e: OfferExpiry): string {
  const when = formatOfferDate(e.expiresOn);
  if (e.state === 'expired') {
    return `The buyer's mortgage offer expired on ${when}. The lender must extend it or issue a new one before exchange or completion.`;
  }
  if (e.daysLeft === 0) return `The buyer's mortgage offer expires today (${when}). Ask the lender about an extension now.`;
  const days = e.daysLeft === 1 ? '1 day' : `${e.daysLeft} days`;
  return `The buyer's mortgage offer expires on ${when}, ${days} from now. If completion may be later, ask the lender about an extension now.`;
}
