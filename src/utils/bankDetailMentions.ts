// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Does a message mention bank details? Payment-diversion fraud in conveyancing
 * works by a message (often from a hacked or look-alike account) giving "new"
 * bank details for the deposit or completion money. Messages are encrypted in
 * the browser (ADR 0011), so this check runs here, on the decrypted text, and
 * nothing it reads leaves the page.
 *
 * Errs towards warning: a false alarm costs one banner, a miss can cost a
 * house deposit.
 */

/** UK sort code written with separators: 12-34-56, 12 34 56. */
const SORT_CODE = /\b\d{2}[-\s]\d{2}[-\s]\d{2}\b/;
/** A UK account number: exactly eight digits on their own. */
const ACCOUNT_NUMBER = /(?<![\d-])\d{8}(?![\d-])/;
/** A UK IBAN, with or without the usual groups of four. */
const GB_IBAN = /\bGB\s?\d{2}\s?[A-Z]{4}(?:\s?\d){14}\b/i;
/** Words people use when giving or changing payment details. */
const PHRASES = [
  /\bsort[\s-]?code\b/i,
  /\baccount\s+(?:number|no\.?)\b/i,
  /\biban\b/i,
  /\bbank\s+(?:account\s+)?details\b/i,
  /\bpayment\s+details\b/i,
  /\b(?:new|different|updated|changed)\s+(?:bank\s+)?account\b/i,
  /\bchange\s+of\s+bank\b/i,
];

export function mentionsBankDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  if (GB_IBAN.test(text)) return true;
  if (SORT_CODE.test(text) && ACCOUNT_NUMBER.test(text)) return true;
  return PHRASES.some((p) => p.test(text));
}
