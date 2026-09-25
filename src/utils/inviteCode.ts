// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Buyer invite codes: TX-XXXX-XXXX.
 *
 * THE BUG THIS REPLACES. The old inline formatter auto-prefixed "TX-" on
 * EVERY keystroke, including while the user was typing the prefix themselves:
 *
 *   type "T"  ->  "T" starts with neither "TX-" nor "TX"  ->  "TX-T"
 *   type "X"  ->  "TX-TX"  -> already starts with "TX-", left alone
 *   ...
 *   typing TX-CT3L-FXAU produced TX-TX-C-T3L-, Continue stayed DISABLED,
 *   and no error was shown because the format check only runs on submit.
 *
 * Pasting worked, because the whole string arrives at once already starting
 * with "TX-". So the buyer join path worked for anyone who pasted and failed
 * silently for anyone who typed. Found on 2026-07-31 by driving the real join
 * page as a buyer.
 *
 * You cannot reliably auto-prefix while the user might also be typing the
 * prefix. So we do not try: keep the user's keystrokes, and NORMALISE at the
 * point the value is used.
 */

/** Longest a raw code can be once punctuation is stripped: TX + 8 body chars. */
const MAX_RAW = 10;

/**
 * Reduce anything the user typed or pasted to the canonical TX-XXXX-XXXX
 * form, or return null when it cannot be one.
 *
 * Accepts every reasonable shape a real person produces:
 *   "TX-CT3L-FXAU", "tx-ct3l-fxau", "TXCT3LFXAU", "ct3l fxau", "CT3L-FXAU"
 */
export function normaliseInviteCode(input: string): string | null {
  const raw = (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // A leading TX is the prefix, not part of the body — but only when there is
  // a body behind it, so "TX" alone is not read as an empty code.
  const body = raw.startsWith('TX') && raw.length > 2 ? raw.slice(2) : raw;
  if (body.length !== 8) return null;
  return `TX-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** True when the input can be normalised to a valid code. */
export function isValidInviteCode(input: string): boolean {
  return normaliseInviteCode(input) !== null;
}

/**
 * Light formatting applied while typing. Deliberately does NOT inject the
 * "TX-" prefix — that is what broke typing. It only uppercases, drops
 * characters that can never appear, and caps the length so the field cannot
 * accumulate junk. Everything else is left exactly as the user typed it.
 */
export function formatInviteCodeInput(input: string): string {
  const cleaned = (input || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  // Cap on the alphanumeric count, not the string length, so hyphens the user
  // types do not eat into the allowance.
  let count = 0;
  let out = '';
  for (const ch of cleaned) {
    if (ch !== '-') {
      if (count >= MAX_RAW) break;
      count += 1;
    }
    out += ch;
  }
  return out;
}
