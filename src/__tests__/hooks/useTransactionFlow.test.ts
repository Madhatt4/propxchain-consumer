import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionFlow } from '../../hooks/useTransactionFlow';
import { useSubscription } from '../../hooks/useSubscription';

import { MOCK_AML_PROVIDERS } from '../../data/mockProviders';
import type { ServiceProvider } from '../../types/provider.types';

// Helper: create a full ServiceProvider for tests
function makeProvider(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return { ...MOCK_AML_PROVIDERS[0], ...overrides };
}

// Mock icpService — must include getTransaction, getFlowState, setFlowState, ledgerManager
const mockGetTransactionProgress = vi.fn().mockResolvedValue(null);
const mockGetTransaction = vi.fn().mockResolvedValue(null);
const mockGetFlowState = vi.fn().mockResolvedValue(null);
const mockSetFlowState = vi.fn().mockResolvedValue(undefined);
const mockLogEvent = vi.fn().mockResolvedValue({ ok: BigInt(1) });
vi.mock('../../services/icp.service', () => ({
  icpService: {
    getTransactionProgress: (...args: unknown[]) => mockGetTransactionProgress(...args),
    getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
    getFlowState: (...args: unknown[]) => mockGetFlowState(...args),
    setFlowState: (...args: unknown[]) => mockSetFlowState(...args),
    ledgerManager: {
      logEvent: (...args: unknown[]) => mockLogEvent(...args),
    },
  },
}));

// Mock authStore
vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    principalId: 'test-principal',
    isInitialized: true,
  })),
}));

// Mock logger to suppress output
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock useSubscription — the hook reads `isPremium` to decide whether the £75
// PropXchain fee applies. Default to premium so the fee-inclusive total assertion
// holds; the Starter-tier test overrides this per-case.
vi.mock('../../hooks/useSubscription', () => ({
  useSubscription: vi.fn(() => ({ isPremium: true })),
}));

/** Set the mocked subscription tier for the next render(s). */
function setPremium(isPremium: boolean): void {
  vi.mocked(useSubscription).mockReturnValue(
    { isPremium } as unknown as ReturnType<typeof useSubscription>,
  );
}

describe('useTransactionFlow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setPremium(true); // default tier for each test; Starter cases override
    mockGetTransactionProgress.mockResolvedValue(null);
    mockGetTransaction.mockResolvedValue(null);
    mockGetFlowState.mockResolvedValue(null);
  });

  it('should default activeJourney to seller', () => {
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    expect(result.current.activeJourney).toBe('seller');
  });

  it('should resolve loading to false after fetch completes', async () => {
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should toggle activeJourney and persist to localStorage', () => {
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    act(() => result.current.setActiveJourney('buyer'));
    expect(result.current.activeJourney).toBe('buyer');
    // Storage is keyed per-principal (`txflow:<tx>:<principalId>`) so a seller
    // and buyer on the same browser don't share journey state — the mocked
    // authStore principal is 'test-principal'.
    const stored = JSON.parse(
      localStorage.getItem('txflow:tx-123:test-principal') ?? '{}',
    );
    expect(stored.activeJourney).toBe('buyer');
  });

  it('should return 7 stages for seller journey', async () => {
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stages).toHaveLength(7);
  });

  it('should resolve stages with no prerequisites as active and stages with unmet prereqs as locked when no milestones completed', async () => {
    // After Task 1: seller-2 and seller-5 no longer have prerequisiteStageIds,
    // so they start active alongside seller-1. Only stages with unmet prereqs are locked.
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    // seller-1: no prereqs → active
    expect(result.current.stages[0].status).toBe('active');
    // seller-2: prereqs removed in Task 1 → active (was locked before)
    expect(result.current.stages[1].status).toBe('active');
    // seller-3: still has prereq ['seller-1'] which is not yet completed → locked
    expect(result.current.stages[2].status).toBe('locked');
  });

  it('should track provider selection in localStorage', async () => {
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    const provider = makeProvider({ id: 'search-provider', priceInPence: 250 });
    act(() => result.current.selectProvider('seller-2', provider));
    expect(result.current.providerSelections.get('seller-2')?.providerId).toBe('search-provider');
    expect(result.current.totalCostPence).toBe(250 + 7500); // provider + PropXchain fee (premium)
    expect(result.current.propxchainFeePence).toBe(7500);
  });

  it('should exclude the £75 PropXchain fee from the total on the free Starter tier', async () => {
    setPremium(false);
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    const provider = makeProvider({ id: 'search-provider', priceInPence: 250 });
    act(() => result.current.selectProvider('seller-2', provider));
    // Starter is free — the running total is provider cost only, no £75.
    expect(result.current.totalCostPence).toBe(250);
    expect(result.current.propxchainFeePence).toBe(0);
  });

  it('should expand and collapse stages (multi-expand)', async () => {
    // Hook now returns expandedStageIds (array) to support multiple open cards
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.toggleStage('seller-1'));
    expect(result.current.expandedStageIds).toContain('seller-1');
    act(() => result.current.toggleStage('seller-1'));
    expect(result.current.expandedStageIds).not.toContain('seller-1');
  });

  it('should store provider rating in localStorage', async () => {
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    const provider = makeProvider({ id: 'search-provider', priceInPence: 250 });
    act(() => result.current.selectProvider('seller-2', provider));
    act(() => result.current.rateProvider('seller-2', 4, 'Great service'));
    const selection = result.current.providerSelections.get('seller-2');
    expect(selection?.review?.rating).toBe(4);
    expect(selection?.review?.comment).toBe('Great service');
  });

  // --- Cross-journey dependency tests ---

  it('should resolve seller-4 as watching when no buyer has joined', async () => {
    mockGetTransactionProgress.mockResolvedValue({
      id: 'tx-123', seller: 'test-principal', buyer: null,
      milestones: [], parties: [],
    });
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    const stage4 = result.current.stages.find(s => s.id === 'seller-4');
    expect(stage4?.status).toBe('watching');
  });

  it('should resolve seller-4 as active when buyer has joined', async () => {
    mockGetTransactionProgress.mockResolvedValue({
      id: 'tx-123', seller: 'test-principal', buyer: 'buyer-principal',
      milestones: [{ name: 'Property details confirmed', status: 'completed', order: 1 }],
      parties: [{ principal: 'buyer-principal', role: 'buyer' }],
    });
    mockGetTransaction.mockResolvedValue({
      seller: { toString: () => 'test-principal' },
      buyer: { toString: () => 'buyer-principal' },
    });
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    const stage4 = result.current.stages.find(s => s.id === 'seller-4');
    // seller-4 (Buyer Progress) status depends on transaction.buyer being truthy
    expect(stage4?.status).toBe('active');
  });

  it('should resolve seller-4 as completed once the seller journey reaches Completion (no 6/7 off-by-one)', async () => {
    // Regression: seller-4 (Buyer Progress) is a passive monitor with no
    // milestone of its own, so it never entered completedIds and stayed
    // 'active' forever — capping the seller progress counter at 6/7 even after
    // the whole transaction completed. It should now flip to 'completed' once
    // the seller's own journey reaches Completion (seller-7).
    mockGetTransactionProgress.mockResolvedValue({
      id: 'tx-123', seller: 'test-principal', buyer: 'buyer-principal',
      milestones: [{ name: 'Property details confirmed', status: 'completed', order: 1 }],
      parties: [{ principal: 'buyer-principal', role: 'buyer' }],
    });
    mockGetTransaction.mockResolvedValue({
      seller: { toString: () => 'test-principal' },
      buyer: { toString: () => 'buyer-principal' },
    });
    // seller-7 persisted as complete via chain flow-state (no milestone exists
    // for stages 5–7, so this is the path completion takes).
    mockGetFlowState.mockResolvedValue({
      completedStages: { 'seller-7': Date.now() },
      providerSelections: {},
    });
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    const stage4 = result.current.stages.find(s => s.id === 'seller-4');
    expect(stage4?.status).toBe('completed');
  });

  it('should resolve buyer-4 as watching while the seller has not completed the property info forms', async () => {
    mockGetTransactionProgress.mockResolvedValue({
      id: 'tx-123', seller: 'seller-principal', buyer: 'test-principal',
      milestones: [{ name: 'Buyer joined', status: 'completed', order: 1 }],
      parties: [],
    });
    mockGetTransaction.mockResolvedValue({
      seller: { toString: () => 'seller-principal' },
      buyer: { toString: () => 'test-principal' },
    });
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setActiveJourney('buyer'));
    const stage4 = result.current.stages.find(s => s.id === 'buyer-4');
    expect(stage4?.status).toBe('watching');
  });

  // Regression: buyer-4 (Review Seller's Pack) must unblock once the seller
  // submits the property information forms (seller-3) ALONE. Searches (seller-2)
  // are not a prerequisite — they're ordered later, buyer/solicitor-side, and on
  // the starter flow seller-2 is a non-self-serve paid step the seller can't
  // complete, which previously left the buyer's Review stuck on "Waiting…".
  it('should resolve buyer-4 as active when the seller has completed the property info forms, even if searches are still open', async () => {
    mockGetTransactionProgress.mockResolvedValue({
      id: 'tx-123', seller: 'seller-principal', buyer: 'test-principal',
      milestones: [
        { name: 'Buyer joined', status: 'completed', order: 1 },
        // Note: NO "Searches completed" milestone — seller-2 is deliberately incomplete.
        { name: 'Property forms complete', status: 'completed', order: 6 },
      ],
      parties: [],
    });
    mockGetTransaction.mockResolvedValue({
      seller: { toString: () => 'seller-principal' },
      buyer: { toString: () => 'test-principal' },
    });
    const { result } = renderHook(() => useTransactionFlow('tx-123'));
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setActiveJourney('buyer'));
    const stage4 = result.current.stages.find(s => s.id === 'buyer-4');
    expect(stage4?.status).toBe('active');
  });

  // --- Audit events — logEvent integration ---

  describe('audit events — logEvent integration', () => {
    it('fires stage-specific event type when completeStage runs for a mapped stage', async () => {
      const { result } = renderHook(() => useTransactionFlow('tx-123'));
      await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

      // seller-3 is mapped to seller_forms_completed after Ship 2c
      act(() => result.current.completeStage('seller-3'));
      await vi.waitFor(() =>
        expect(mockLogEvent).toHaveBeenCalledWith(
          'tx-123',
          'seller_forms_completed',
          expect.stringContaining('seller-3'),
          expect.any(Array),
        ),
      );
    });

    it('falls back to stage_completed for unmapped stage IDs', async () => {
      const { result } = renderHook(() => useTransactionFlow('tx-123'));
      await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.completeStage('seller-unknown-future-stage'));
      await vi.waitFor(() =>
        expect(mockLogEvent).toHaveBeenCalledWith(
          'tx-123',
          'stage_completed',
          expect.stringContaining('seller-unknown-future-stage'),
          expect.any(Array),
        ),
      );
    });

    it('maps seller-1 to transaction_created event type', async () => {
      const { result } = renderHook(() => useTransactionFlow('tx-123'));
      await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.completeStage('seller-1'));
      await vi.waitFor(() =>
        expect(mockLogEvent).toHaveBeenCalledWith(
          'tx-123',
          'transaction_created',
          expect.any(String),
          expect.any(Array),
        ),
      );
    });

    it('fires provider_selected on selectProvider', async () => {
      const { result } = renderHook(() => useTransactionFlow('tx-123'));
      await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.selectProvider('seller-2', makeProvider({
        id: 'p1', name: 'ACME Searches', priceInPence: 250,
      })));
      await vi.waitFor(() =>
        expect(mockLogEvent).toHaveBeenCalledWith(
          'tx-123',
          'provider_selected',
          expect.stringMatching(/seller-2|ACME Searches/),
          expect.any(Array),
        ),
      );
    });

    it('does not throw when logEvent rejects (fire-and-forget)', async () => {
      mockLogEvent.mockRejectedValueOnce(new Error('canister down'));
      const { result } = renderHook(() => useTransactionFlow('tx-123'));
      await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(() => act(() => result.current.completeStage('seller-1'))).not.toThrow();
    });
  });
});
