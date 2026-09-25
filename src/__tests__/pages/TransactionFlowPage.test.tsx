import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Mock useTransactionFlow
vi.mock('../../hooks/useTransactionFlow', () => ({
  useTransactionFlow: vi.fn(() => ({
    transaction: null,
    userRole: 'seller',
    stages: [
      {
        id: 'seller-1',
        order: 1,
        title: 'List Property',
        description: '',
        status: 'active',
        journeyRole: 'seller',
        prerequisiteStageIds: [],
        hasProviderMarketplace: false,
        serviceMode: 'mock',
      },
      {
        id: 'seller-2',
        order: 2,
        title: 'Property Searches',
        description: '',
        status: 'locked',
        journeyRole: 'seller',
        prerequisiteStageIds: ['seller-1'],
        hasProviderMarketplace: true,
        providerCategory: 'searches',
        serviceMode: 'real-read',
      },
    ],
    otherPartyStages: [],
    activeJourney: 'seller',
    setActiveJourney: vi.fn(),
    providerSelections: new Map(),
    selectProvider: vi.fn(),
    clearProvider: vi.fn(),
    rateProvider: vi.fn(),
    completeStage: vi.fn(),
    totalCostPence: 7500,
    propxchainFeePence: 7500,
    expandedStageIds: [],
    toggleStage: vi.fn(),
    editingStageIds: [],
    setStageEditing: vi.fn(),
    isLoading: false,
    error: null,
    chainPersistError: null,
    invalidationKey: 0,
    bumpInvalidationKey: vi.fn(),
    syntheticEvents: [],
  })),
}));

// Mock useProviderFlow (added by provider marketplace feature)
vi.mock('../../hooks/useProviderFlow', () => ({
  useProviderFlow: vi.fn(() => ({
    propertyGeo: null,
    turboMode: false,
    setTurboMode: vi.fn(),
    toServiceProvider: vi.fn(),
    enrichWithDistance: vi.fn((p: unknown[]) => p),
  })),
}));

// Mock confetti
vi.mock('../../utils/confetti', () => ({
  fireConfetti: vi.fn(),
}));

// The page asks the chain-verified writer for the viewer's own party row on
// mount; keep that off the network here and assert it happens.
const mockEnsureMyRoleFromChain = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve());
vi.mock('../../services/partyRole.service', () => ({
  partyRoleService: { ensureMyRoleFromChain: (id: string) => mockEnsureMyRoleFromChain(id) },
}));

// Mock rightmoveStorage. The active stage's detail body renders open by
// default in the tabbed layout, so ListPropertyStage mounts and needs the
// title-number helpers mocked too.
vi.mock('../../utils/rightmoveStorage', () => ({
  getRightmoveData: vi.fn(() => null),
  storeRightmoveData: vi.fn(),
  getTitleNumber: vi.fn(() => null),
  storeTitleNumber: vi.fn(),
  syncListingFromChain: vi.fn(() => Promise.resolve(null)),
}));

// Import AFTER mocking
const { default: TransactionFlowPage } = await import('../../pages/TransactionFlowPage');

function renderWithRouter(): void {
  // TransactionFlowPage renders NextStepCard, which calls useQueryClient — it
  // must be wrapped in a QueryClientProvider exactly as the real app is.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/transaction/1/flow']}>
          <Routes>
            <Route path="/transaction/:id/flow" element={<TransactionFlowPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('TransactionFlowPage', () => {
  it('should render stage cards', () => {
    renderWithRouter();
    expect(screen.getAllByText('List Property').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Property Searches').length).toBeGreaterThan(0);
  });

  it('should show stage status badges', () => {
    // Badges now render in both the stage tab row and the active stage's
    // detail card, so the same label can legitimately appear twice.
    renderWithRouter();
    expect(screen.getAllByText(/action needed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/locked/i).length).toBeGreaterThan(0);
  });

  it('should render stage numbers', () => {
    renderWithRouter();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it("should ask the chain-verified writer for the viewer's own party row once for the routed transaction", () => {
    mockEnsureMyRoleFromChain.mockClear();
    renderWithRouter();
    expect(mockEnsureMyRoleFromChain).toHaveBeenCalledTimes(1);
    expect(mockEnsureMyRoleFromChain).toHaveBeenCalledWith('1');
  });
});
