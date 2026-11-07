// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// Listing descriptions imported from portals arrive as HTML ("<p>Three
// bedroom…</p><br>"). React escapes them, so the tags showed as text. We
// render plain text rather than HTML: no sanitiser is a direct dependency,
// and a description needs paragraphs, not markup.

const BLOCK_BREAK = /<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?\s*>/gi;
const ANY_TAG = /<[^>]*>/g;

/**
 * Plain text of a listing description, with paragraph and line breaks kept as
 * newlines (render with `whitespace-pre-line`). Text with no tags is returned
 * as it was, apart from trimming.
 */
export function listingDescriptionText(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!/[<&]/.test(raw)) return raw.trim();
  const withBreaks = raw.replace(BLOCK_BREAK, '\n');
  let text: string;
  if (typeof DOMParser !== 'undefined') {
    // DOMParser builds an inert document: no script runs and nothing loads.
    // textContent drops every remaining tag and decodes entities (&amp; -> &).
    const body = new DOMParser().parseFromString(withBreaks, 'text/html').body;
    body.querySelectorAll('script, style').forEach((el) => el.remove());
    text = body.textContent ?? '';
  } else {
    text = withBreaks.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(ANY_TAG, '');
  }
  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
