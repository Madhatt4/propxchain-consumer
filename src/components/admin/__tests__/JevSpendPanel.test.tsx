// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockLoad = vi.fn();

vi.mock('@/services/jevSpend.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jevSpend.service')>();
  return { ...actual, loadJevSpend: (...args: unknown[]) => mockLoad(...args) };
});

import { JevSpendPanel } from '../JevSpendPanel';

describe('JevSpendPanel', () => {
  beforeEach(() => {
    mockLoad.mockReset();
  });

  it('should show the four window totals and a row per function', async () => {
    mockLoad.mockResolvedValue({
      functions: [
        {
          fn: 'doc-classify',
          label: 'Document checks and consents scan',
          windows: {
            today: { calls: 3, inputTokens: 4200, costUsd: 0.0021 },
            '30d': { calls: 32, inputTokens: 46778, costUsd: 0.0234 },
            all: { calls: 32, inputTokens: 46778, costUsd: 0.0234 },
          },
        },
      ],
      totals: {
        today: { calls: 3, inputTokens: 4200, costUsd: 0.0021 },
        '7d': { calls: 10, inputTokens: 12000, costUsd: 0.009 },
        '30d': { calls: 32, inputTokens: 46778, costUsd: 0.0234 },
        all: { calls: 46, inputTokens: 54682, costUsd: 0.0274 },
      },
    });

    render(<JevSpendPanel />);

    expect(await screen.findByText('Jev · Today')).toBeInTheDocument();
    expect(screen.getAllByText('$0.0021').length).toBeGreaterThan(0);
    expect(screen.getByText('$0.0274')).toBeInTheDocument();
    expect(screen.getByText('Document checks and consents scan')).toBeInTheDocument();
    expect(screen.getByText('46 calls · 54,682 tokens')).toBeInTheDocument();
  });

  it('should say so quietly when nothing is readable', async () => {
    mockLoad.mockResolvedValue(null);

    render(<JevSpendPanel />);

    expect(await screen.findByText(/No Jev calls recorded yet/)).toBeInTheDocument();
  });
});
