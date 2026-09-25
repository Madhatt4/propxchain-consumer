// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockStalls = vi.fn();
const mockStage = vi.fn();
vi.mock('@/services/stall.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/stall.service')>()),
  loadDealStalls: (...args: unknown[]) => mockStalls(...args),
  loadDealStage: (...args: unknown[]) => mockStage(...args),
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { StallLine } from '../StallLine';
import type { DealStall } from '@/services/stall.service';

const stall = (over: Partial<DealStall>): DealStall => ({
  signal: 'enquiry_unanswered', owner: 'seller_conveyancer', since: '2026-08-27T09:00:00Z', days: 9,
  label: 'enquiries waiting for an answer', detail: {}, ...over,
});
const STAGE = { stage: 'enquiries', enteredAt: '2026-08-24T09:00:00Z', days: 12, benchmarkDays: 14, sampleN: 0 };

describe('StallLine', () => {
  beforeEach(() => {
    mockStalls.mockReset();
    mockStage.mockReset().mockResolvedValue(STAGE);
  });

  it('shows the longest wait by role, how many more, and the stage against the benchmark', async () => {
    mockStalls.mockResolvedValue([stall({}), stall({ signal: 'hmlr_not_fetched', owner: 'seller', label: 'title register not fetched', days: 20 })]);
    render(<StallLine transactionId="tx_1" />);
    const line = await screen.findByTestId('stall-line');
    expect(line).toHaveAttribute('data-owner', 'seller');
    expect(line).toHaveTextContent('Waiting on the seller: title register not fetched, 20 days (+1 more waiting)');
    expect(screen.getByTestId('stage-line')).toHaveTextContent('Enquiries: day 12 of a usual 14');
    expect(mockStage).toHaveBeenCalledWith('tx_1');
  });

  it('side filters to that side, compact skips the stage read and the count', async () => {
    mockStalls.mockResolvedValue([stall({}), stall({ signal: 'buyer_pack_untouched', owner: 'buyer', label: 'buyer pack not started', days: 20 })]);
    render(<StallLine transactionId="tx_1" side="seller" variant="compact" />);
    const line = await screen.findByTestId('stall-line');
    expect(line).toHaveTextContent("Waiting on the seller's conveyancer: enquiries waiting for an answer, 9 days");
    expect(line).not.toHaveTextContent('more waiting');
    expect(screen.queryByTestId('stage-line')).toBeNull();
    expect(mockStage).not.toHaveBeenCalled();
  });

  it('renders nothing when there is nothing to say, and nothing on an error', async () => {
    mockStalls.mockResolvedValue([]);
    mockStage.mockResolvedValue(null);
    const { unmount } = render(<StallLine transactionId="tx_1" />);
    await waitFor(() => expect(mockStalls).toHaveBeenCalled());
    expect(screen.queryByTestId('stall-line')).toBeNull();
    unmount();
    mockStalls.mockRejectedValue(new Error('permission denied'));
    mockStage.mockRejectedValue(new Error('permission denied'));
    render(<StallLine transactionId="tx_2" />);
    await waitFor(() => expect(mockStalls).toHaveBeenCalledWith('tx_2'));
    expect(screen.queryByTestId('stall-line')).toBeNull();
  });

  it('a stage that cannot be read does not hide the stalls', async () => {
    mockStalls.mockResolvedValue([stall({})]);
    mockStage.mockRejectedValue(new Error('permission denied'));
    render(<StallLine transactionId="tx_1" />);
    expect(await screen.findByTestId('stall-line')).toHaveTextContent("Waiting on the seller's conveyancer");
    expect(screen.queryByTestId('stage-line')).toBeNull();
  });

  it('switching transaction clears the old line until the new read settles', async () => {
    mockStalls.mockResolvedValueOnce([stall({})]);
    const { rerender } = render(<StallLine transactionId="tx_1" />);
    await screen.findByTestId('stall-line');
    mockStalls.mockReturnValueOnce(new Promise(() => undefined));
    mockStage.mockReturnValueOnce(new Promise(() => undefined));
    rerender(<StallLine transactionId="tx_2" />);
    expect(screen.queryByTestId('stall-line')).toBeNull();
  });

  it('a stage alone still renders the stage line', async () => {
    mockStalls.mockResolvedValue([]);
    render(<StallLine transactionId="tx_1" />);
    expect(await screen.findByTestId('stage-line')).toHaveTextContent('Enquiries: day 12 of a usual 14');
  });
});
