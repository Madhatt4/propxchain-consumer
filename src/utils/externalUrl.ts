// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Normalising and guarding agent-entered links to other websites.
 *
 * Two functions rather than one because the two jobs have opposite failure
 * modes. `normaliseExternalUrl` is forgiving — it runs on input, where the
 * agent types what they'd say out loud ("demoandsons.co.uk/45-laburnum") and
 * being rejected for a missing scheme is just an obstacle. `safeExternalUrl`
 * is strict — it runs at render, where the value came out of the database and
 * a `javascript:` payload in an `href` is an XSS vector. Anything stored before
 * this validation existed, or written straight through the API, still passes
 * through the render guard.
 */

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Normalise a URL an agent typed into a form.
 *
 * Blank (or whitespace) becomes `null` — clearing the field is a legitimate
 * edit, not an error. A bare host gains `https://`. Anything that still isn't
 * a parseable http(s) URL returns `undefined`, which the caller shows as a
 * validation message; `null` and `undefined` mean different things here and
 * are not interchangeable.
 */
export function normaliseExternalUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // A scheme-less host is what people actually type. Only assume https when
  // there is no scheme at all — never rewrite one we're about to reject, or
  // "javascript:alert(1)" would become "https://javascript:alert(1)".
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return undefined;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return undefined;
  // A dotted host, not merely a non-empty one. `!` is not a forbidden host
  // character, so a typo like "nope!!" parses happily as https://nope!! and
  // would be stored as a real address — this field only ever holds a public
  // website, so requiring a dot costs nothing and catches the single-word slip.
  if (!parsed.hostname.includes('.')) return undefined;
  return parsed.toString();
}

/**
 * Guard a stored URL at render time. Returns the URL only if it is a
 * well-formed http(s) address, otherwise `null` so the caller renders nothing
 * rather than an unsafe `href`.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}
