// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, expect, it, vi } from 'vitest';
import { loadScriptOnce } from '../googleDrivePicker';

describe('loadScriptOnce', () => {
  function fakeDocument(): { doc: Document; scripts: Array<Record<string, unknown>> } {
    const scripts: Array<Record<string, unknown>> = [];
    const doc = {
      createElement: () => {
        const script: Record<string, unknown> = { remove: vi.fn() };
        scripts.push(script);
        return script;
      },
      head: { appendChild: vi.fn() },
    } as unknown as Document;
    return { doc, scripts };
  }

  it('should add the script tag once and reuse the pending load', async () => {
    const { doc, scripts } = fakeDocument();

    const first = loadScriptOnce('https://example.test/once.js', doc);
    const second = loadScriptOnce('https://example.test/once.js', doc);
    (scripts[0].onload as () => void)();

    await expect(first).resolves.toBeUndefined();
    expect(second).toBe(first);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://example.test/once.js');
  });

  it('should forget a failed load so the next click can retry', async () => {
    const { doc, scripts } = fakeDocument();

    const first = loadScriptOnce('https://example.test/retry.js', doc);
    (scripts[0].onerror as () => void)();
    await expect(first).rejects.toMatchObject({ kind: 'load' });
    loadScriptOnce('https://example.test/retry.js', doc);

    expect(scripts).toHaveLength(2);
    expect(scripts[0].remove).toHaveBeenCalled();
  });
});
