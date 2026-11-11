// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Until 2026-11-11 the canister invented a Land Registry confirmation number,
 * "LR-CONF-<tx id>", for a submission that never happened
 * (Madhatt4/Propxchain#422). The field is now always null, and PropXchain
 * never lodges with HMLR, so no screen may show a confirmation number line,
 * empty or otherwise. Only the type declaration may name the field.
 */

const TYPE_FILE = 'types/landRegistry.ts';

// Same walker as noBundledIdentities.test.ts: `fs.globSync` is missing on CI's Node 20.
function sourceFiles(): string[] {
  return readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((f) => /[.]tsx?$/.test(f))
    .filter((f) => !f.includes('__tests__') && !f.includes('.test.') && f !== TYPE_FILE)
    .map((f) => join(process.cwd(), 'src', f));
}

describe('Land Registry confirmation number', () => {
  it('should not be read or shown anywhere in the app', () => {
    const pattern = /landRegistryConfirmationNumber|LR-CONF/;
    const offenders = sourceFiles().filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  }, 20_000);
});
