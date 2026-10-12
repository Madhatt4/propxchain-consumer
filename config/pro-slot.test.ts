// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveProSlot } from './pro-slot';

describe('resolveProSlot', () => {
  it('uses the stub when the private package is not checked out', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'pro-slot-'));
    expect(resolveProSlot(root)).toBe(path.join(root, 'src/pro-slot/stub.tsx'));
  });

  it('uses the private package when it is present', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'pro-slot-'));
    mkdirSync(path.join(root, 'src/pro-private'), { recursive: true });
    writeFileSync(path.join(root, 'src/pro-private/index.tsx'), 'export default () => null;');
    expect(resolveProSlot(root)).toBe(path.join(root, 'src/pro-private/index.tsx'));
  });
});
