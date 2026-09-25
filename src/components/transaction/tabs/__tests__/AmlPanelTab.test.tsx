import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// NOTE: @testing-library/user-event is not a dependency of this repo (checked
// package.json + pnpm-lock.yaml — absent, not even hoisted transitively).
// fireEvent already covers the same interactions (change + click) and is the
// convention the rest of this file uses, so we stick with it rather than add
// a new dependency mid-task.
function typeInto(element: HTMLElement, value: string): void {
  fireEvent.change(element, { target: { value } });
}

const flags = vi.hoisted(() => ({ AML_ENABLED: true }));
vi.mock('@/config/features', () => ({ FEATURE_FLAGS: flags }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockGetPricing = vi.fn();
const mockListChecks = vi.fn();
const mockCreateOrder = vi.fn();
const mockReportUrl = vi.fn();
vi.mock('@/services/aml.service', () => ({
  amlProductRef: (id: string) => `aml:${id}`,
  amlService: {
    getPricing: (...a: unknown[]) => mockGetPricing(...a),
    listChecks: (...a: unknown[]) => mockListChecks(...a),
    createOrder: (...a: unknown[]) => mockCreateOrder(...a),
    reportUrl: (...a: unknown[]) => mockReportUrl(...a),
  },
}));

vi.mock('@/services/icp.service', () => ({
  icpService: { getUserPrincipal: vi.fn(async () => 'me') },
}));

const mockLoadRoster = vi.fn();
vi.mock('@/services/shareParty.service', () => ({
  sharePartyService: { loadRoster: (...a: unknown[]) => mockLoadRoster(...a) },
}));

const mockPrepareSession = vi.fn();
vi.mock('@/services/stripePayment.service', () => ({
  stripePaymentService: { prepareSearchCheckoutSession: (...a: unknown[]) => mockPrepareSession(...a) },
}));

const mockStoreDocument = vi.fn();
const mockListMyDocuments = vi.fn();
vi.mock('@/services/vaultDocument.service', () => ({
  vaultDocumentService: {
    storeDocument: (...a: unknown[]) => mockStoreDocument(...a),
    listMyDocuments: (...a: unknown[]) => mockListMyDocuments(...a),
  },
}));

const mockSend = vi.fn();
vi.mock('@/services/transactionWallet.service', () => ({
  transactionWalletService: { send: (...a: unknown[]) => mockSend(...a) },
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ tier: 'premium' }),
}));

const mockEnsureMyRole = vi.fn();
vi.mock('@/services/partyRole.service', () => ({
  partyRoleService: { ensureMyRoleFromChain: (...a: unknown[]) => mockEnsureMyRole(...a) },
}));

import { AmlPanelTab } from '../AmlPanelTab';

const PROVIDER = { id: 'verify365', name: 'Verify 365' };
const PRICING = {
  provider: PROVIDER,
  tiers: [
    { tier: 'standard', retailPence: 1234 },
    { tier: 'enhanced', retailPence: 5678 },
  ],
};

function renderTab(): void {
  render(
    <MemoryRouter initialEntries={['/transaction/TX-1/flow?tab=aml']}>
      <AmlPanelTab transactionId="TX-1" locked={false} requiredTier="starter" />
    </MemoryRouter>,
  );
}

/** Fills the subject's-own-details form on a card so `submit` clears validation. */
function fillContactDetails(card: HTMLElement): void {
  typeInto(within(card).getByLabelText(/first name/i), 'Ada');
  typeInto(within(card).getByLabelText(/last name/i), 'Lovelace');
  typeInto(within(card).getByLabelText(/mobile/i), '+447700900000');
  typeInto(within(card).getByLabelText(/email/i), 'ada@example.com');
}

const PERSONAL_DETAILS = {
  firstName: 'Ada', lastName: 'Lovelace', phone: '+447700900000', email: 'ada@example.com',
};

// Every field AmlCheck declares, so a later field addition fails loudly
// rather than silently reading undefined.
const baseCheck = {
  id: 'chk-1', transactionId: 'TX-1', subjectPrincipal: 'me', provider: 'verify365',
  tier: 'standard' as const, status: 'complete' as const, paymentStatus: 'paid' as const,
  retailPence: 1980, createdAt: '2026-09-01T00:00:00Z', completedAt: '2026-09-01T01:00:00Z',
  hasReport: true,
};

describe('AmlPanelTab', () => {
  beforeEach(() => {
    flags.AML_ENABLED = true;
    mockGetPricing.mockReset().mockResolvedValue(PRICING);
    mockListChecks.mockReset().mockResolvedValue([]);
    mockCreateOrder.mockReset();
    mockPrepareSession.mockReset();
    mockReportUrl.mockReset();
    mockStoreDocument.mockReset();
    mockListMyDocuments.mockReset().mockResolvedValue([]);
    mockSend.mockReset();
    mockEnsureMyRole.mockReset().mockResolvedValue(undefined);
    // The real roster never contains me (loadRoster strips the current user —
    // it exists for choosing share targets). An earlier version of this mock
    // put 'me' in `parties`, which hid that the panel could never show the
    // self-start card in production. My card comes from `mySide` alone.
    mockLoadRoster.mockReset().mockResolvedValue({
      mySide: 'seller',
      parties: [
        { principal: 'buyer-1', label: 'Buyer — Sam', role: 'buyer', side: 'buyer' },
        { principal: 'conv-1', label: 'Conveyancer — Firm', role: 'conveyancer', side: 'buyer' },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render one card per buyer and seller with server prices and no Lite tier', async () => {
    renderTab();
    await screen.findByTestId('aml-card-me');
    expect(screen.getByTestId('aml-card-buyer-1')).toBeInTheDocument();
    expect(screen.queryByTestId('aml-card-conv-1')).not.toBeInTheDocument();
    expect(screen.getAllByText('£12.34').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£56.78').length).toBeGreaterThan(0);
    expect(screen.queryByText(/lite/i)).not.toBeInTheDocument();
  });

  it('should default to Standard and hand a server-priced order to Stripe without sending a price', async () => {
    mockCreateOrder.mockResolvedValue({ id: 'ord-1', retailPence: 1234 });
    mockPrepareSession.mockResolvedValue({ sessionId: 's1', url: 'https://checkout.stripe.com/x' });
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    fillContactDetails(card);
    fireEvent.click(within(card).getByRole('button', { name: /start/i }));
    await waitFor(() =>
      expect(mockCreateOrder).toHaveBeenCalledWith({
        transactionId: 'TX-1', subjectPrincipal: 'me', tier: 'standard', personalDetails: PERSONAL_DETAILS,
      }),
    );
    expect(mockPrepareSession).toHaveBeenCalledWith(
      expect.objectContaining({ principalId: 'me', type: 'aml', productRef: 'aml:ord-1', cancelPath: expect.stringContaining('?tab=aml') }),
    );
    // Broad, name-agnostic guard kept alongside the specific check below: a
    // client-influenced price becomes a real Stripe charge, so this must catch
    // a price-shaped key under ANY future name, not just the two we know about
    // today. Do not narrow this to save it from a false positive — fix the
    // false positive instead.
    expect(JSON.stringify(mockCreateOrder.mock.calls[0][0])).not.toMatch(/pence|price/i);
    expect(JSON.stringify(mockCreateOrder.mock.calls[0][0])).not.toMatch(/retailpence|tierprice/i);
  });

  // Only the subject's own card can start their check now (self-only ordering),
  // so the Enhanced-tier flow is exercised on 'me', not 'buyer-1'.
  it('should order Enhanced when the upgrade is chosen', async () => {
    mockCreateOrder.mockResolvedValue({ id: 'ord-2', retailPence: 5678 });
    mockPrepareSession.mockResolvedValue({ sessionId: 's2', url: 'https://checkout.stripe.com/y' });
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    fireEvent.click(card.querySelector('input[value="enhanced"]')!);
    fillContactDetails(card);
    fireEvent.click(within(card).getByRole('button', { name: /start/i }));
    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ subjectPrincipal: 'me', tier: 'enhanced' })));
  });

  it('should show the worker refusal and leave the card startable', async () => {
    mockCreateOrder.mockRejectedValue(new Error('A check is already in progress for this person'));
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    fillContactDetails(card);
    fireEvent.click(within(card).getByRole('button', { name: /start/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already in progress');
    expect(mockPrepareSession).not.toHaveBeenCalled();
  });

  it('should show progress and hide the start button for a check in flight', async () => {
    mockListChecks.mockResolvedValue([
      { id: 'c1', transactionId: 'TX-1', subjectPrincipal: 'buyer-1', tier: 'standard', status: 'in_progress', paymentStatus: 'paid', retailPence: 1234, createdAt: '2026-08-25T00:00:00Z', completedAt: null, hasReport: false, provider: 'verify365' },
    ]);
    renderTab();
    const card = await screen.findByTestId('aml-card-buyer-1');
    expect(card).toHaveTextContent('In progress');
    expect(card.querySelector('button')).toBeNull();
  });

  it('should link a completed check to the Transaction Wallet', async () => {
    mockListChecks.mockResolvedValue([
      { id: 'c1', transactionId: 'TX-1', subjectPrincipal: 'me', tier: 'enhanced', status: 'complete', paymentStatus: 'paid', retailPence: 5678, createdAt: '2026-08-25T00:00:00Z', completedAt: '2026-08-25T01:00:00Z', hasReport: true, provider: 'verify365' },
    ]);
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    const link = card.querySelector('a')!;
    expect(link).toHaveAttribute('href', '/transaction/TX-1/flow?tab=wallet');
  });

  it('should surface a load failure instead of inventing prices', async () => {
    mockGetPricing.mockRejectedValue(new Error('AML pricing is not configured'));
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent('not configured');
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });

  it('should show the coming-soon card and call nothing when the flag is off', async () => {
    flags.AML_ENABLED = false;
    renderTab();
    expect(await screen.findByText(/coming soon/i)).toBeInTheDocument();
    expect(mockLoadRoster).not.toHaveBeenCalled();
    expect(mockGetPricing).not.toHaveBeenCalled();
  });

  it('should offer a start button only on my own card', async () => {
    renderTab();
    await screen.findByTestId('aml-card-me');
    expect(within(screen.getByTestId('aml-card-me')).getByRole('button', { name: /start/i })).toBeInTheDocument();
    expect(within(screen.getByTestId('aml-card-buyer-1')).queryByRole('button', { name: /start/i })).toBeNull();
  });

  it('should brand the panel as the provider the worker declares, before any check exists', async () => {
    renderTab();
    await screen.findByTestId('aml-card-me');
    expect(screen.getByTestId('aml-provider-badge')).toHaveTextContent('Checks by Verify 365');
    expect(screen.getByText(/carried out by Verify 365, not by PropXchain/i)).toBeInTheDocument();
    // The same deletion promise appears in the disclaimer and on the card, in one phrasing.
    expect(screen.getAllByText(/deletes its own copy once the check is placed with Verify 365/i)).toHaveLength(2);
    const card = screen.getByTestId('aml-card-me');
    expect(within(card).getByRole('button', { name: /start standard check with verify 365/i })).toBeInTheDocument();
    expect(within(card).getByText(/these details go to Verify 365/i)).toBeInTheDocument();
  });

  it('should fall back to anonymous wording when the worker names no provider and no check exists', async () => {
    mockGetPricing.mockResolvedValue({ provider: null, tiers: PRICING.tiers });
    renderTab();
    await screen.findByTestId('aml-card-me');
    expect(screen.getByTestId('aml-provider-badge')).toHaveTextContent('Checks by our verification partner');
    expect(screen.queryByText(/Verify 365/)).toBeNull();
  });

  it('should let an existing check name its own provider over the worker declaration', async () => {
    mockListChecks.mockResolvedValue([{ ...baseCheck, subjectPrincipal: 'buyer-1', status: 'in_progress', provider: 'acme-aml', hasReport: false }]);
    renderTab();
    const card = await screen.findByTestId('aml-card-buyer-1');
    expect(card).toHaveTextContent('acme-aml');
    // The panel-level badge follows the first check too, so the copy never contradicts a card.
    expect(screen.getByTestId('aml-provider-badge')).toHaveTextContent('Checks by acme-aml');
  });

  it('should build my own card from my on-chain side, since the roster only lists other people', async () => {
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    expect(card).toHaveTextContent('Seller');
    expect(card).toHaveTextContent('(you)');
  });

  it('should record my party row before asking the worker for checks', async () => {
    renderTab();
    await screen.findByTestId('aml-card-me');
    expect(mockEnsureMyRole).toHaveBeenCalledWith('TX-1');
    // The worker 403s /checks without the row, so the order is the point.
    expect(mockEnsureMyRole.mock.invocationCallOrder[0]).toBeLessThan(mockListChecks.mock.invocationCallOrder[0]);
  });

  it('should still list checks and show my card when recording the row throws', async () => {
    mockEnsureMyRole.mockRejectedValue(new Error('session storage exploded'));
    renderTab();
    expect(await screen.findByTestId('aml-card-me')).toBeInTheDocument();
    expect(mockListChecks).toHaveBeenCalledWith('TX-1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show no card of mine and record nothing when I am not a buyer or seller', async () => {
    mockLoadRoster.mockResolvedValue({
      mySide: null,
      parties: [{ principal: 'buyer-1', label: 'Buyer — Sam', role: 'buyer', side: 'buyer' }],
    });
    renderTab();
    await screen.findByTestId('aml-card-buyer-1');
    expect(screen.queryByTestId('aml-card-me')).toBeNull();
    expect(mockEnsureMyRole).not.toHaveBeenCalled();
  });

  it('should explain who can start another party check rather than showing a dead control', async () => {
    renderTab();
    await screen.findByTestId('aml-card-buyer-1');
    expect(
      within(screen.getByTestId('aml-card-buyer-1')).getByText(/from their own account/i),
    ).toBeInTheDocument();
  });

  it('should not submit until every contact field is filled', async () => {
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    fireEvent.click(within(card).getByRole('button', { name: /start/i }));
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(within(card).getByText(/we need your name, mobile and email/i)).toBeInTheDocument();
  });

  it('should send the subject own details and no price when the form is complete', async () => {
    mockCreateOrder.mockResolvedValue({ id: 'chk-1', retailPence: 1980 });
    mockPrepareSession.mockResolvedValue({ sessionId: 'cs_1', url: 'https://checkout.stripe.com/x' });
    renderTab();
    const card = await screen.findByTestId('aml-card-me');

    fillContactDetails(card);
    fireEvent.click(within(card).getByRole('button', { name: /start/i }));

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
    const arg = mockCreateOrder.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.subjectPrincipal).toBe('me');
    expect(arg.personalDetails).toEqual(PERSONAL_DETAILS);
    // The price is the worker's to decide. Any price-shaped key here is a bug.
    expect(arg).not.toHaveProperty('retailPence');
    expect(arg).not.toHaveProperty('tierPrice');
  });

  it('should tell the checkout this is an aml order, not a search', async () => {
    mockCreateOrder.mockResolvedValue({ id: 'chk-1', retailPence: 1980 });
    mockPrepareSession.mockResolvedValue({ sessionId: 'cs_1', url: 'https://checkout.stripe.com/x' });
    renderTab();
    const card = await screen.findByTestId('aml-card-me');
    fillContactDetails(card);
    fireEvent.click(within(card).getByRole('button', { name: /start/i }));

    await waitFor(() => expect(mockPrepareSession).toHaveBeenCalled());
    // Without type:'aml' payment-worker looks for this check in groundsure_orders.
    expect(mockPrepareSession.mock.calls[0][0]).toMatchObject({ type: 'aml', productRef: 'aml:chk-1' });
  });

  it('should put a completed report into the wallet and send it to the deal', async () => {
    mockListChecks.mockResolvedValue([baseCheck]);
    mockListMyDocuments.mockResolvedValue([]);
    mockReportUrl.mockResolvedValue('https://signed/report.pdf');
    mockStoreDocument.mockResolvedValue({ id: 'doc-1' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['%PDF-1.4']), { status: 200 })));

    renderTab();

    await waitFor(() => expect(mockStoreDocument).toHaveBeenCalled());
    expect(mockSend).toHaveBeenCalledWith('TX-1', { id: 'doc-1' });
  });

  it('should add the report to the wallet only once', async () => {
    mockListChecks.mockResolvedValue([baseCheck]);
    // Already filed on a previous mount — the label is the idempotency key.
    mockListMyDocuments.mockResolvedValue([{ id: 'doc-1', label: 'ID & AML report — chk-1' }]);
    // The happy path would otherwise succeed: without these, storeDocument
    // would never be reached anyway (reportUrl resolves to undefined and the
    // unstubbed real fetch would throw), which would let this test pass for
    // the wrong reason. Set it up so the guard is the ONLY thing stopping it.
    mockReportUrl.mockResolvedValue('https://signed/report.pdf');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['%PDF-1.4']), { status: 200 })));

    renderTab();

    await waitFor(() => expect(mockListMyDocuments).toHaveBeenCalled());
    // listMyDocuments is only the first hop of the happy path — reportUrl,
    // fetch, storeDocument and send all come after it. Asserting immediately
    // here would pass even with the guard deleted, simply because none of
    // those later hops have had a turn on the event loop yet. Give them one.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockStoreDocument).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should not try to file another party report into my wallet', async () => {
    mockListChecks.mockResolvedValue([{ ...baseCheck, id: 'chk-2', subjectPrincipal: 'buyer-1' }]);
    mockListMyDocuments.mockResolvedValue([]);

    renderTab();

    await waitFor(() => expect(mockListChecks).toHaveBeenCalled());
    expect(mockStoreDocument).not.toHaveBeenCalled();
    expect(mockReportUrl).not.toHaveBeenCalled();
  });

  it('should not leave the panel broken when the wallet write fails', async () => {
    mockListChecks.mockResolvedValue([baseCheck]);
    mockListMyDocuments.mockResolvedValue([]);
    mockReportUrl.mockRejectedValue(new Error('signing failed'));
    vi.stubGlobal('fetch', vi.fn());

    renderTab();

    // The report is a convenience; a failure to file it must not take the panel
    // down or hide the check status the user came here to read.
    expect(await screen.findByTestId('aml-card-me')).toBeInTheDocument();
  });
});
