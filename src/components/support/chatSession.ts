// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The two things the chat widget remembers for the length of a browser tab:
 * the half-typed message, and whether the "not legal advice" line has already
 * been shown.
 *
 * `sessionStorage`, never `localStorage`. A question someone typed and did not
 * send is their own words about their own move, so it should not outlive the
 * tab, and it must never be read back by us — it is never sent anywhere.
 *
 * Every access is wrapped: `sessionStorage` throws outright in some privacy
 * modes, and a chat widget that cannot open because storage is blocked is a
 * worse failure than a draft that is not kept.
 */

const DRAFT_KEY = 'pxc.supportChat.draft';
const DISCLAIMER_KEY = 'pxc.supportChat.disclaimerShown';

export function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(text: string): void {
  try {
    if (text) sessionStorage.setItem(DRAFT_KEY, text);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable or full. The draft is a convenience, not the message.
  }
}

export function clearDraft(): void {
  writeDraft('');
}

/** True once the footer has been shown in this tab, so it appears only once. */
export function hasShownDisclaimer(): boolean {
  try {
    return sessionStorage.getItem(DISCLAIMER_KEY) === '1';
  } catch {
    return false;
  }
}

export function markDisclaimerShown(): void {
  try {
    sessionStorage.setItem(DISCLAIMER_KEY, '1');
  } catch {
    // Unreadable storage means the footer shows again next time, which is the
    // safe direction to fail for a disclaimer.
  }
}
