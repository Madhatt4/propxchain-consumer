import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MortgageFundingStage } from '../MortgageFundingStage';
import type { StageConfig } from '../../../../../types/stage.types';
import type { BuyerPackItem } from '@/services/buyerPack.service';

const mockLoad = vi.fn();
const mockDeclare = vi.fn();
const mockSync = vi.fn();
const mockReadOffer = vi.fn();
vi.mock('@/services/buyerPack.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/buyerPack.service')>('@/services/buyerPack.service');
  return {
    ...actual,
    loadBuyerPack: (...a: unknown[]) => mockLoad(...a),
    declareBuyerPack: (...a: unknown[]) => mockDeclare(...a),
    syncBuyerPack: (...a: unknown[]) => mockSync(...a),
    readOfferExpiry: (...a: unknown[]) => mockReadOffer(...a),
  };
});
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/services/lenderPanel.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/lenderPanel.service')>();
  return {
    ...actual,
    lenderPanelService: {
      getLenders: vi.fn().mockResolvedValue(['Barclays Bank UK PLC', 'Santander']),
      getPanelConveyancerIds: vi.fn().mockResolvedValue([]),
      clearCache: vi.fn(),
    },
  };
});
vi.mock('../../../tabs/buyerPack/SendToSlot', () => ({
  SendToSlot: ({ slots }: { slots: readonly string[] }) => <div data-testid="send-to-slot">{slots.join(',')}</div>,
}));

function makeStage(status: StageConfig['status']): StageConfig {
  return {
    id: 'buyer-2', order: 2, title: 'Mortgage / Funding', description: '', journeyRole: 'buyer',
    prerequisiteStageIds: [], hasProviderMarketplace: false, serviceMode: 'mock', status,
  } as StageConfig;
}
const pack = (mortgage: Partial<BuyerPackItem>): BuyerPackItem[] => [
  { item: 'id_aml', status: 'not_started', detail: {}, onLedger: false, pending: false },
  { item: 'proof_of_funds', status: 'not_started', detail: {}, onLedger: false, pending: false },
  { item: 'mortgage', status: 'not_started', detail: {}, onLedger: false, pending: false, ...mortgage },
  { item: 'chain', status: 'not_started', detail: {}, onLedger: false, pending: false },
  { item: 'survey', status: 'not_started', detail: {}, onLedger: false, pending: false },
];
const READY_MORTGAGE = pack({ status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Santander', mortgage_stage: 'dip' }, onLedger: true });
const r = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('MortgageFundingStage', () => {
  beforeEach(() => { mockLoad.mockReset(); mockDeclare.mockReset(); mockSync.mockReset(); mockReadOffer.mockReset(); });

  const OFFER_SENT = pack({ status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Santander', mortgage_stage: 'offer' }, onLedger: true });

  it('once the offer is sent, reads its expiry for the buyer to check and saves the date they confirm', async () => {
    mockLoad.mockResolvedValue(OFFER_SENT);
    mockReadOffer.mockResolvedValue({ expiresOn: '2027-03-31' });
    mockDeclare.mockResolvedValue(pack({ status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Santander', mortgage_stage: 'offer', offer_expires_on: '2027-04-01' }, onLedger: true }));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" />);
    await waitFor(() => expect(screen.getByLabelText(/When does your mortgage offer expire/)).toHaveValue('2027-03-31'));
    expect(mockReadOffer).toHaveBeenCalledWith('tx_1');
    expect(screen.getByTestId('offer-expiry-note')).toHaveTextContent(/Check it matches/);
    // The buyer corrects it against the paper offer before saving.
    fireEvent.change(screen.getByLabelText(/When does your mortgage offer expire/), { target: { value: '2027-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and check' }));
    await waitFor(() => expect(mockDeclare).toHaveBeenCalledWith('tx_1', { fundingType: 'mortgage', lenderName: 'Santander', mortgageOfferExpiresOn: '2027-04-01' }));
  });

  it('a saved date is not overwritten by a fresh read, and a failed read asks the buyer to type it', async () => {
    mockLoad.mockResolvedValue(pack({ status: 'ready', detail: { funding_type: 'mortgage', mortgage_stage: 'offer', offer_expires_on: '2027-01-15' }, onLedger: true }));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" />);
    await waitFor(() => expect(screen.getByLabelText(/When does your mortgage offer expire/)).toHaveValue('2027-01-15'));
    expect(mockReadOffer).not.toHaveBeenCalled();
    mockReadOffer.mockResolvedValue({ expiresOn: null, reason: 'no_date_found' });
    fireEvent.click(screen.getByRole('button', { name: 'Read it from my offer' }));
    expect(await screen.findByTestId('offer-expiry-note')).toHaveTextContent(/type it in/);
    expect(screen.getByLabelText(/When does your mortgage offer expire/)).toHaveValue('2027-01-15');
  });

  it('no expiry field before an offer is sent', async () => {
    mockLoad.mockResolvedValue(READY_MORTGAGE);
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Santander'));
    expect(screen.queryByLabelText(/When does your mortgage offer expire/)).not.toBeInTheDocument();
    expect(mockReadOffer).not.toHaveBeenCalled();
  });

  it('a completed stage summarises the pack line, never an amount', async () => {
    mockLoad.mockResolvedValue(READY_MORTGAGE);
    r(<MortgageFundingStage stage={makeStage('completed')} transactionId="tx_1" />);
    expect(await screen.findByText('Mortgage · DIP held · Santander')).toBeInTheDocument();
    expect(screen.getByText('Funding confirmed')).toBeInTheDocument();
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });

  it('the form pre-fills from the pack and offers the DIP/offer send for a mortgage', async () => {
    mockLoad.mockResolvedValue(pack({ status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Santander', mortgage_stage: 'none' } }));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Santander'));
    expect(screen.getByTestId('send-to-slot')).toHaveTextContent('decisionInPrinciple,mortgageOffer');
    expect(screen.getByText(/completes once the document is sent/)).toBeInTheDocument();
  });

  it('a cash buyer sends proof of funds instead', async () => {
    mockLoad.mockResolvedValue(pack({}));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" />);
    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cash Buyer' }));
    expect(screen.getByTestId('send-to-slot')).toHaveTextContent('amlSourceOfFunds');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('confirming declares type and lender, then completes only when the pack says ready', async () => {
    const onComplete = vi.fn();
    mockLoad.mockResolvedValue(pack({}));
    mockDeclare.mockResolvedValueOnce(pack({ status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Santander', mortgage_stage: 'none' } }));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" onComplete={onComplete} />);
    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Mortgage' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Santander' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and check' }));
    await waitFor(() => expect(mockDeclare).toHaveBeenCalledWith('tx_1', { fundingType: 'mortgage', lenderName: 'Santander' }));
    expect(onComplete).not.toHaveBeenCalled();
    mockDeclare.mockResolvedValueOnce(READY_MORTGAGE);
    fireEvent.click(screen.getByRole('button', { name: 'Save and check' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('buyer-2'));
  });

  it('a cash buyer completes once proof of funds makes the mortgage item ready', async () => {
    const onComplete = vi.fn();
    mockLoad.mockResolvedValue(pack({}));
    mockDeclare.mockResolvedValue(pack({ status: 'ready', detail: { funding_type: 'cash' }, onLedger: true }));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" onComplete={onComplete} />);
    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cash Buyer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and check' }));
    await waitFor(() => expect(mockDeclare).toHaveBeenCalledWith('tx_1', { fundingType: 'cash', lenderName: null }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('buyer-2'));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('Other lender keeps the typed name and sends it in the declaration', async () => {
    mockLoad.mockResolvedValue(pack({}));
    mockDeclare.mockResolvedValue(pack({ status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Bedford Building Society' } }));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" />);
    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Mortgage' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__other__' } });
    fireEvent.change(screen.getByPlaceholderText('Lender name'), { target: { value: 'Bedford Building Society' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and check' }));
    await waitFor(() => expect(mockDeclare).toHaveBeenCalledWith('tx_1', { fundingType: 'mortgage', lenderName: 'Bedford Building Society' }));
  });

  it('saving an edit declares, then hands back to the parent', async () => {
    const onAfterEdit = vi.fn();
    const onCancelEdit = vi.fn();
    mockLoad.mockResolvedValue(READY_MORTGAGE);
    mockDeclare.mockResolvedValue(READY_MORTGAGE);
    r(<MortgageFundingStage stage={makeStage('completed')} transactionId="tx_1" isEditing onAfterEdit={onAfterEdit} onCancelEdit={onCancelEdit} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Santander'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onAfterEdit).toHaveBeenCalled());
    expect(onCancelEdit).toHaveBeenCalled();
  });

  it('a declaration failure is shown and the stage does not complete', async () => {
    const onComplete = vi.fn();
    mockLoad.mockResolvedValue(pack({}));
    mockDeclare.mockRejectedValue(new Error('forbidden'));
    r(<MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" onComplete={onComplete} />);
    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cash Buyer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and check' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('forbidden'));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
