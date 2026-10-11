// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Everything in `src/` ends up in a public JavaScript bundle, and this repo is
 * public. A review of the live bundle on 2026-10-11 found the admin principal
 * readable by anyone: it was stored as a GitHub secret, but Vite pastes every
 * VITE_ variable into the code it ships, so "secret" meant nothing. A canister
 * controller principal was also hard-coded into the audit report.
 *
 * Admin status now comes only from the user_management canister (useIsAdmin /
 * amIAdmin). These checks stop either leak coming back.
 *
 * Canister IDs (`…-cai`) are public by nature, but this repo's rule is that
 * none are hard-coded: they come from `@propxchain/core-client` and
 * `canister_ids.json` through `src/config/canisterIds.ts`, so a recreated
 * canister is fixed in one published place.
 */

// Same walker as pricingClaims.test.ts: `fs.globSync` is missing on CI's Node 20.
function sourceFiles(): string[] {
  return readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((f) => /[.]tsx?$/.test(f))
    .filter((f) => !f.includes('__tests__') && !f.includes('.test.'))
    .map((f) => join(process.cwd(), 'src', f));
}

// A self-authenticating user or controller principal: ten 5-char groups and a
// 3-char tail. Canister IDs are shorter and end in -cai, so they never match.
const USER_PRINCIPAL = /\b[a-z0-9]{5}(?:-[a-z0-9]{5}){9}-[a-z0-9]{3}\b/g;

// Read once: the scan covers ~900 files, and under full-suite load reading
// them per test pushed each test past the 5s default.
let cache: { file: string; text: string }[] | null = null;
function sources(): { file: string; text: string }[] {
  cache ??= sourceFiles().map((file) => ({ file, text: readFileSync(file, 'utf8') }));
  return cache;
}

function offenders(pattern: RegExp): string[] {
  return sources().flatMap(({ file, text }) => {
    const hits = text.match(pattern) ?? [];
    return hits.map((hit) => `${file.replace(/\\/g, '/').split('/src/')[1]}: ${hit}`);
  });
}

const SCAN_TIMEOUT_MS = 30_000;

const CANISTER_ID = /\b[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-cai\b/g;

// Internet Computer system canisters, not PropXchain's. The admin testing
// panel uses them as obviously-foreign principals for its mock personas.
const IC_SYSTEM_CANISTERS = new Set([
  'rrkah-fqaaa-aaaaa-aaaaq-cai', // local replica's default first canister
  'ryjl3-tyaaa-aaaaa-aaaba-cai', // NNS ICP ledger
]);

// Example and placeholder addresses must use the reserved example.com domain:
// a made-up name at a real-looking firm's domain can be someone's real inbox.
// Real mailboxes the product genuinely emails or shows are listed by domain.
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[a-z]{2,})/g;
const ALLOWED_EMAIL_DOMAINS = new Set([
  'example.com',
  'propxchain.com', // our own mailboxes
  'optimus-move.co.uk', // survey partner's referral inbox, shown to users
]);

describe('identities in the shipped bundle', () => {
  it('should not hard-code any user or controller principal in production source', () => {
    // Arrange / Act
    const found = offenders(USER_PRINCIPAL);

    // Assert
    expect(found).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  it('should not read an admin allowlist from a build-time variable', () => {
    // Arrange / Act
    const found = offenders(/VITE_ADMIN_PRINCIPALS/g);

    // Assert
    expect(found).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  it('should not hard-code a PropXchain canister id in production source', () => {
    // Arrange / Act
    const found = offenders(CANISTER_ID).filter((hit) => !IC_SYSTEM_CANISTERS.has(hit.split(': ')[1]));

    // Assert
    expect(found).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  it('should only use example.com or known real mailboxes for email addresses', () => {
    // Arrange / Act
    const found = offenders(EMAIL).filter((hit) => {
      const domain = hit.split('@').pop()?.toLowerCase() ?? '';
      return !ALLOWED_EMAIL_DOMAINS.has(domain);
    });

    // Assert
    expect(found).toEqual([]);
  }, SCAN_TIMEOUT_MS);

  it('should catch a principal-shaped string and ignore a canister id', () => {
    // Arrange
    const principal = ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxy', 'zabcd', 'efghi', 'jklmn', 'opqrs', 'tuvwx', 'yza'].join('-');
    const canisterId = 'abcde-fghij-klmno-pqrst-cai';

    // Act
    const principalHits = principal.match(USER_PRINCIPAL) ?? [];
    const canisterHits = canisterId.match(USER_PRINCIPAL) ?? [];

    // Assert
    expect(principalHits).toEqual([principal]);
    expect(canisterHits).toEqual([]);
  });
});
