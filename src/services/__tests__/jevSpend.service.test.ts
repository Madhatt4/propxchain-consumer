// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { formatUsd, loadJevSpend, summariseSpend } from '../jevSpend.service';

const ROWS = [
  { fn: 'doc-classify', spend_window: 'today', calls: '3', input_tokens: '4200', cost_usd: '0.0021' },
  { fn: 'doc-classify', spend_window: '30d', calls: 32, input_tokens: 46778, cost_usd: 0.0234 },
  { fn: 'doc-classify', spend_window: 'all', calls: 32, input_tokens: 46778, cost_usd: null },
  { fn: 'transaction-monitor', spend_window: 'all', calls: 14, input_tokens: 7904, cost_usd: 0.004 },
  { fn: 'transaction-monitor', spend_window: 'weird', calls: 1, input_tokens: 1, cost_usd: 1 },
];

describe('summariseSpend', () => {
  it('should group the rows by function, label them, and total each window', () => {
    const summary = summariseSpend(ROWS);

    expect(summary.functions.map((f) => f.fn)).toEqual(['doc-classify', 'transaction-monitor']);
    expect(summary.functions[0].label).toBe('Document checks and consents scan');
    expect(summary.functions[0].windows.today).toEqual({ calls: 3, inputTokens: 4200, costUsd: 0.0021 });
    expect(summary.totals.all).toEqual({ calls: 46, inputTokens: 54682, costUsd: 0.004 });
    expect(summary.totals['7d']).toEqual({ calls: 0, inputTokens: 0, costUsd: 0 });
  });

  it('should treat an unpriced window as zero cost and drop a window it does not know', () => {
    const summary = summariseSpend(ROWS);

    expect(summary.functions[0].windows.all?.costUsd).toBe(0);
    expect(Object.keys(summary.functions[1].windows)).toEqual(['all']);
  });

  it('should fall back to the function name when it has no label', () => {
    const [fn] = summariseSpend([{ fn: 'new-thing', spend_window: 'all', calls: 1, input_tokens: 1, cost_usd: 0 }]).functions;
    expect(fn.label).toBe('new-thing');
  });
});

describe('loadJevSpend', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('should call the summary function and summarise its rows', async () => {
    mockRpc.mockResolvedValue({ data: ROWS, error: null });

    const summary = await loadJevSpend();

    expect(mockRpc).toHaveBeenCalledWith('jev_spend_summary');
    expect(summary?.functions).toHaveLength(2);
  });

  it('should resolve null when the function errors or the call throws', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    expect(await loadJevSpend()).toBeNull();

    mockRpc.mockRejectedValue(new Error('offline'));
    expect(await loadJevSpend()).toBeNull();
  });
});

describe('formatUsd', () => {
  it('should show four decimals under a dollar and two above', () => {
    expect(formatUsd(0.0412)).toBe('$0.0412');
    expect(formatUsd(12.345)).toBe('$12.35');
    expect(formatUsd(0)).toBe('$0.0000');
  });
});
