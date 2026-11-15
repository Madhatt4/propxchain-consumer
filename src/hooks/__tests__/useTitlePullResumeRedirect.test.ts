// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TransactionFlowPage's return-from-Stripe redirect: with a paid title pull
 * pending and Stage 1 done, open the Sales pack once — never for a buyer,
 * never without a pending pull, never twice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { savePendingState } from '@/services/hmlrPullPending';
import { useTitlePullResumeRedirect, type TitlePullResumeRedirectInput } from '../useTitlePullResumeRedirect';

function savePending(transactionId = 'tx-1'): void {
  savePendingState({ titleNumber: 'GR506405', transactionId, startedAt: new Date().toISOString(), sessionId: 'cs_test_1' });
}

function setup(initial: Partial<TitlePullResumeRedirectInput> = {}): {
  openSalesPack: ReturnType<typeof vi.fn>;
  rerender: (next: Partial<TitlePullResumeRedirectInput>) => void;
} {
  const openSalesPack = vi.fn();
  const base: TitlePullResumeRedirectInput = {
    transactionId: 'tx-1',
    isSellerWithStage1Done: true,
    hasChosenStage: false,
    openSalesPack,
    ...initial,
  };
  const { rerender } = renderHook((props: TitlePullResumeRedirectInput) => useTitlePullResumeRedirect(props), {
    initialProps: base,
  });
  return { openSalesPack, rerender: (next) => rerender({ ...base, ...next }) };
}

beforeEach(() => {
  localStorage.clear();
});

describe('useTitlePullResumeRedirect', () => {
  it('should open the Sales pack when a pull is pending and the seller has Stage 1 done', () => {
    savePending();
    const { openSalesPack } = setup();
    expect(openSalesPack).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when no pull is pending', () => {
    const { openSalesPack } = setup();
    expect(openSalesPack).not.toHaveBeenCalled();
  });

  it('should do nothing when the pending pull is for another deal', () => {
    savePending('tx-2');
    const { openSalesPack } = setup();
    expect(openSalesPack).not.toHaveBeenCalled();
  });

  it('should do nothing for a buyer (or before Stage 1 is done)', () => {
    savePending();
    const { openSalesPack } = setup({ isSellerWithStage1Done: false });
    expect(openSalesPack).not.toHaveBeenCalled();
  });

  it('should wait for the stages to load, then fire', () => {
    savePending();
    const { openSalesPack, rerender } = setup({ isSellerWithStage1Done: false });
    rerender({ isSellerWithStage1Done: true });
    expect(openSalesPack).toHaveBeenCalledTimes(1);
  });

  it('should never override a stage the seller already picked', () => {
    savePending();
    const { openSalesPack } = setup({ hasChosenStage: true });
    expect(openSalesPack).not.toHaveBeenCalled();
  });

  it('should fire only once, even after the seller leaves the pack while still pending', () => {
    savePending();
    const { openSalesPack, rerender } = setup();
    rerender({ hasChosenStage: true });
    rerender({ hasChosenStage: false });
    expect(openSalesPack).toHaveBeenCalledTimes(1);
  });
});
