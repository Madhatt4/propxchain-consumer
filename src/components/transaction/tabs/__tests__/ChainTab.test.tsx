// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChainTab } from '../ChainTab';
import { isChainUnlocked } from '@/services/chainEntitlement.service';
import { getChain, type ChainResult } from '@/services/chainService';
import { icpService } from '@/services/icp.service';
import type { TransactionTabProps } from '../transactionTabs.config';

vi.mock('@/services/chainEntitlement.service', () => ({
  isChainUnlocked: vi.fn(),
}));

vi.mock('@/services/chainService', () => ({
  getChain: vi.fn(),
}));

vi.mock('@/services/icp.service', () => ({
  icpService: {
    getUserPrincipal: vi.fn().mockResolvedValue('principal-abc'),
  },
}));

vi.mock('@/components/transaction/ChainUnlockButton', () => ({
  ChainUnlockButton: ({ onUnlocked }: { onUnlocked: () => void }) => (
    <button type="button" onClick={onUnlocked}>
      Mock Unlock
    </button>
  ),
}));

const BASE_PROPS: TransactionTabProps = {
  transactionId: 'tx-1',
  uprn: '38192980',
  propertyAddress: '1 Cobblestone Corner, Liverpool',
  locked: false,
  requiredTier: 'starter',
};

const SAMPLE_RESULT: ChainResult = {
  status: 'in_chain',
  chain: {
    chainId: 'chain-1',
    chainType: 'IN_CHAIN',
    chainLength: 1,
    queriedAddress: '1 Cobblestone Corner, Liverpool',
    properties: [
      {
        id: 1,
        uprn: 38192980,
        displayAddress: '1 Cobblestone Corner, Liverpool',
        transactionType: [],
        milestones: [{ label: 'SSTC', date: '2026-04-01' }],
        connections: { upwardChain: [], downwardChain: [] },
      },
    ],
  },
};

describe('ChainTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the unlock teaser and never calls getChain when the entitlement check resolves false', async () => {
    vi.mocked(isChainUnlocked).mockResolvedValue(false);

    render(<ChainTab {...BASE_PROPS} />);

    expect(await screen.findByText(/See your live property chain/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Mock Unlock/i })).toBeInTheDocument();

    // THE key property: an unpaid chain tab must never hit the (paid) VMC proxy.
    expect(getChain).not.toHaveBeenCalled();
  });

  it('shows a retry affordance instead of an indefinite spinner when getUserPrincipal fails (M3)', async () => {
    vi.mocked(isChainUnlocked).mockResolvedValue(false);
    vi.mocked(icpService.getUserPrincipal)
      .mockRejectedValueOnce(new Error('identity unavailable'))
      .mockResolvedValueOnce('principal-abc');

    render(<ChainTab {...BASE_PROPS} />);

    // The stuck-forever state this guards against: a clear error + a way
    // to retry, not an indefinite "Preparing checkout…" spinner.
    expect(await screen.findByText(/Couldn.t prepare checkout: identity unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Preparing checkout…/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

    expect(await screen.findByRole('button', { name: /Mock Unlock/i })).toBeInTheDocument();
  });

  it('calls getChain with the transactionId and renders the live chain when unlocked', async () => {
    vi.mocked(isChainUnlocked).mockResolvedValue(true);
    vi.mocked(getChain).mockResolvedValue(SAMPLE_RESULT);

    render(<ChainTab {...BASE_PROPS} />);

    await waitFor(() =>
      expect(getChain).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'tx-1' })),
    );
    expect(await screen.findByText(/1 Cobblestone Corner, Liverpool/i)).toBeInTheDocument();
    expect(screen.queryByText(/See your live property chain/i)).not.toBeInTheDocument();
  });

  it('polls the entitlement grant after unlock instead of racing a not-yet-propagated webhook into a hard error (I1)', async () => {
    // Models a real backend: the on-chain grant (written by the async Stripe
    // webhook) only lands after a few polls — both isChainUnlocked and the
    // (paid) getChain proxy check the SAME underlying grant state, exactly
    // like production where the proxy's entitlement check and this query
    // read the same canister fact.
    let grantPropagated = false;
    let isChainUnlockedCalls = 0;
    vi.mocked(isChainUnlocked).mockImplementation(async () => {
      isChainUnlockedCalls += 1;
      if (isChainUnlockedCalls === 1) return false; // initial mount check — not yet paid
      if (isChainUnlockedCalls >= 4) grantPropagated = true; // webhook lands on the 3rd poll
      return grantPropagated;
    });
    vi.mocked(getChain).mockImplementation(async () => {
      if (!grantPropagated) throw new Error('VMC proxy 402');
      return SAMPLE_RESULT;
    });

    render(<ChainTab {...BASE_PROPS} />);

    const unlockButton = await screen.findByRole('button', { name: /Mock Unlock/i });

    vi.useFakeTimers();
    fireEvent.click(unlockButton);

    // Advance past the bounded retry window in one go.
    await vi.advanceTimersByTimeAsync(10000);
    vi.useRealTimers();

    // The regression this guards against: a hard VMC-proxy error must never
    // surface while the grant is merely propagating.
    expect(screen.queryByText(/Couldn.t load chain status/i)).not.toBeInTheDocument();

    expect(await screen.findByText(/1 Cobblestone Corner, Liverpool/i)).toBeInTheDocument();
    expect(getChain).toHaveBeenCalledTimes(1);
  });

  it('shows the benign delayed message and never calls getChain when the grant never confirms (I1 bounded retry exhausted)', async () => {
    // isChainUnlocked never resolves true — models a grant that never
    // propagates (e.g. a stuck/failed webhook), not just a slow one.
    vi.mocked(isChainUnlocked).mockResolvedValue(false);

    render(<ChainTab {...BASE_PROPS} />);

    const unlockButton = await screen.findByRole('button', { name: /Mock Unlock/i });

    vi.useFakeTimers();
    fireEvent.click(unlockButton);

    // Exhaust the hook's full bounded retry window: 4 attempts (0..3) with
    // 2s + 3s + 3s delays between them (~8s total) before it gives up and
    // flips to 'delayed'. Advance well past that in one go.
    await vi.advanceTimersByTimeAsync(10000);
    vi.useRealTimers();

    // Benign "still being prepared" message — never a hard error, and never
    // falls back to the "pay again" teaser either.
    expect(await screen.findByText(/your chain is still being prepared/i)).toBeInTheDocument();

    // The regression this guards against: a grant that never confirms must
    // never fall through to the (paid) VMC proxy call, and must never
    // surface the proxy's own hard-402 error text.
    expect(getChain).not.toHaveBeenCalled();
    expect(screen.queryByText(/Couldn.t load chain status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VMC proxy 402/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/See your live property chain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 Cobblestone Corner, Liverpool/i)).not.toBeInTheDocument();
  });

  it('resets the unlock gate on transactionId change so a stale unlock never leaks a VMC call for an unconfirmed transaction', async () => {
    let resolveTx2: ((unlocked: boolean) => void) | undefined;
    vi.mocked(isChainUnlocked).mockImplementation((id: string) => {
      if (id === 'tx-2') return new Promise<boolean>((resolve) => { resolveTx2 = resolve; });
      return Promise.resolve(true);
    });
    vi.mocked(getChain).mockResolvedValue(SAMPLE_RESULT);

    const { rerender } = render(<ChainTab {...BASE_PROPS} />);

    // tx-1's entitlement check resolves true immediately — getChain fires for tx-1.
    await waitFor(() =>
      expect(getChain).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'tx-1' })),
    );
    vi.mocked(getChain).mockClear();

    // Client-side navigate to tx-2 without a remount (back/forward, deep link).
    // tx-2's entitlement check is still pending — payment for tx-2 is unconfirmed.
    rerender(<ChainTab {...BASE_PROPS} transactionId="tx-2" />);
    await waitFor(() => expect(isChainUnlocked).toHaveBeenCalledWith('tx-2'));

    // THE fix under test: a stale `true` from tx-1 must not leak across the
    // transactionId change, so no VMC call happens for tx-2 while unconfirmed.
    expect(getChain).not.toHaveBeenCalled();

    // Once tx-2's check genuinely resolves true, getChain is allowed to fire for it.
    resolveTx2?.(true);
    await waitFor(() =>
      expect(getChain).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'tx-2' })),
    );
  });
});
