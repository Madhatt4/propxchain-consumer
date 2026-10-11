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
 * Canister IDs (`…-cai`) are not covered: every request to a canister names
 * its ID, so they are public by nature.
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
