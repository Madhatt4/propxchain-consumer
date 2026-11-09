/**
 * A completed client stage can be reopened from the deal page. On the live
 * test of 2026-11-09 the seller could not get back to a submitted Property
 * Information stage (to replace a TA6), nor the buyer to a confirmed Mortgage /
 * Funding stage (to reach the offer expiry and its AI read). Reopening puts the
 * stage into edit mode only: it must never un-complete it or write anything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../contexts/ThemeContext';
import type { StageConfig } from '../../types/stage.types';
import type { BuyerPackItem } from '../../services/buyerPack.service';

const mockCompleteStage = vi.fn();
const mockSetStageEditing = vi.fn();
const mockDeclare = vi.fn();
const flow: { stages: StageConfig[]; editing: string[]; role: 'seller' | 'buyer' } = { stages: [], editing: [], role: 'seller' };

vi.mock('../../hooks/useTransactionFlow', () => ({
  useTransactionFlow: vi.fn(() => ({
    transaction: null,
    userRole: flow.role,
    dealSide: flow.role,
    stages: flow.stages,
    otherPartyStages: [],
    activeJourney: flow.role,
    setActiveJourney: vi.fn(),
    providerSelections: new Map(),
    selectProvider: vi.fn(),
    clearProvider: vi.fn(),
    rateProvider: vi.fn(),
    completeStage: mockCompleteStage,
    totalCostPence: 0,
    expandedStageIds: [],
    toggleStage: vi.fn(),
    editingStageIds: flow.editing,
    setStageEditing: mockSetStageEditing,
    isLoading: false,
    error: null,
    accessDenied: false,
    chainPersistError: null,
    invalidationKey: 0,
    bumpInvalidationKey: vi.fn(),
    syntheticEvents: [],
  })),
}));
vi.mock('../../hooks/useProviderFlow', () => ({
  useProviderFlow: vi.fn(() => ({ turboMode: false, setTurboMode: vi.fn(), toServiceProvider: vi.fn() })),
}));
vi.mock('../../utils/confetti', () => ({ fireConfetti: vi.fn() }));
vi.mock('../../services/partyRole.service', () => ({
  partyRoleService: { ensureMyRoleFromChain: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../../utils/rightmoveStorage', () => ({
  getRightmoveData: vi.fn(() => null),
  storeRightmoveData: vi.fn(),
  getTitleNumber: vi.fn(() => null),
  storeTitleNumber: vi.fn(),
  syncListingFromChain: vi.fn(() => Promise.resolve(null)),
}));
// The forms stage hydrates from the canister: a TA6 filled online, no TA10.
vi.mock('@/services/icp.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/icp.service')>();
  Object.assign(actual.icpService, {
    getTA6: vi.fn().mockResolvedValue(null),
    getTA10: vi.fn().mockResolvedValue(null),
    getTA7: vi.fn().mockResolvedValue(null),
    getTransaction: vi.fn().mockResolvedValue({ sellers: [[{ ta6FormUploaded: true, ta10FormUploaded: true }]] }),
  });
  return actual;
});
vi.mock('@/services/documentFindings.service', () => ({ loadPaperworkFindings: vi.fn().mockResolvedValue([]) }));
vi.mock('../../components/explainer/ExplainerModal', () => ({ default: () => null }));
vi.mock('../../components/explainer/ExplainerCard', () => ({ default: () => null }));
const OFFER_SENT: BuyerPackItem[] = [
  { item: 'mortgage', status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Santander', mortgage_stage: 'offer', offer_expires_on: '2027-03-31' }, onLedger: true, pending: false },
];
vi.mock('@/services/buyerPack.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/buyerPack.service')>();
  return {
    ...actual,
    loadBuyerPack: vi.fn(() => Promise.resolve(OFFER_SENT)),
    declareBuyerPack: (...a: unknown[]) => mockDeclare(...a),
    syncBuyerPack: vi.fn(() => Promise.resolve(OFFER_SENT)),
    readOfferExpiry: vi.fn(),
  };
});

const { default: TransactionFlowPage } = await import('../../pages/TransactionFlowPage');

function stage(id: string, order: number, title: string, role: 'seller' | 'buyer'): StageConfig {
  return {
    id, order, title, description: '', status: 'completed', journeyRole: role,
    prerequisiteStageIds: [], hasProviderMarketplace: false, serviceMode: 'real-read',
  };
}

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/transaction/tx_1/flow']}>
          <Routes>
            <Route path="/transaction/:id/flow" element={<TransactionFlowPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('TransactionFlowPage — reopening a completed stage', () => {
  beforeEach(() => {
    mockCompleteStage.mockReset();
    mockSetStageEditing.mockReset();
    mockDeclare.mockReset();
    flow.editing = [];
  });

  it('should offer "Review or update" on completed Property Info Forms and enter edit mode without completing anything', async () => {
    flow.role = 'seller';
    flow.stages = [stage('seller-3', 3, 'Property Info Forms', 'seller')];
    renderPage();

    expect(await screen.findByText('Property information forms submitted')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review or update' }));

    expect(mockSetStageEditing).toHaveBeenCalledWith('seller-3', true);
    expect(mockCompleteStage).not.toHaveBeenCalled();
  });

  it('should show the forms panel again once Property Info Forms is reopened, and Close leaves edit mode', async () => {
    flow.role = 'seller';
    flow.stages = [stage('seller-3', 3, 'Property Info Forms', 'seller')];
    flow.editing = ['seller-3'];
    renderPage();

    // The uploaded TA6 can be replaced; the forms can be opened online again.
    expect(await screen.findAllByRole('button', { name: 'Replace upload' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Edit form' })).toHaveLength(2);
    expect(screen.queryByText('Property information forms submitted')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit All Forms/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockSetStageEditing).toHaveBeenCalledWith('seller-3', false);
    expect(mockCompleteStage).not.toHaveBeenCalled();
  });

  it('should offer "Review or update" on completed Mortgage / Funding and reopen to the offer expiry without writing', async () => {
    flow.role = 'buyer';
    flow.stages = [stage('buyer-2', 2, 'Mortgage / Funding', 'buyer')];
    const view = renderPage();

    expect(await screen.findByText('Funding confirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review or update' }));
    expect(mockSetStageEditing).toHaveBeenCalledWith('buyer-2', true);

    flow.editing = ['buyer-2'];
    view.unmount();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/When does your mortgage offer expire/)).toHaveValue('2027-03-31'));
    expect(screen.getByRole('button', { name: 'Read it from my offer' })).toBeInTheDocument();
    expect(mockCompleteStage).not.toHaveBeenCalled();
    expect(mockDeclare).not.toHaveBeenCalled();
  });

  it.each([
    ['seller-6', 'seller', 'Exchange'],
    ['seller-7', 'seller', 'Completion'],
    ['buyer-6', 'buyer', 'Exchange'],
    ['buyer-7', 'buyer', 'Completion'],
  ] as const)('should not offer "Review or update" on chain-derived stage %s', (id, role, title) => {
    flow.role = role;
    flow.stages = [stage(id, 6, title, role)];
    renderPage();
    expect(screen.queryByRole('button', { name: 'Review or update' })).not.toBeInTheDocument();
  });
});
