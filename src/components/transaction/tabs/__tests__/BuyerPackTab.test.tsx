// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockParty = vi.fn();
vi.mock('@/services/enquiries.service', () => ({ myPartyOn: (...a: unknown[]) => mockParty(...a) }));
const mockLoad = vi.fn();
const mockSync = vi.fn();
const mockDeclare = vi.fn();
vi.mock('@/services/buyerPack.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/buyerPack.service')>('@/services/buyerPack.service');
  return {
    ...actual,
    loadBuyerPack: (...a: unknown[]) => mockLoad(...a),
    syncBuyerPack: (...a: unknown[]) => mockSync(...a),
    declareBuyerPack: (...a: unknown[]) => mockDeclare(...a),
  };
});
vi.mock('../buyerPack/SendToSlot', () => ({ SendToSlot: () => <div data-testid="send-to-slot" /> }));
vi.mock('@/services/chainEntitlement.service', () => ({ isChainUnlocked: () => Promise.resolve(false) }));
import { BuyerPackTab } from '../BuyerPackTab';

const ITEMS = [
  { item: 'id_aml', status: 'ready', detail: { aml_state: 'complete' }, onLedger: true, pending: false },
  { item: 'proof_of_funds', status: 'not_started', detail: {}, onLedger: false, pending: false },
  { item: 'mortgage', status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Halifax', mortgage_stage: 'none' }, onLedger: false, pending: false },
  { item: 'chain', status: 'ready', detail: { chain_position: 'none' }, onLedger: false, pending: true },
  { item: 'survey', status: 'not_started', detail: { survey_state: 'none' }, onLedger: false, pending: false },
] as const;
const props = { transactionId: 'tx_1', locked: false, requiredTier: 'starter' as const };
const renderTab = () => render(<MemoryRouter><BuyerPackTab {...props} /></MemoryRouter>);

describe('BuyerPackTab', () => {
  beforeEach(() => { mockParty.mockReset(); mockLoad.mockReset(); mockSync.mockReset(); mockDeclare.mockReset(); });

  it('the buyer syncs on open and gets the actions: AML link, send-to-slot, the three declarations', async () => {
    mockParty.mockResolvedValue({ role: 'buyer', side: 'buyer' });
    mockSync.mockResolvedValue([...ITEMS]);
    renderTab();
    await waitFor(() => expect(screen.getByText('2 of 5 ready')).toBeInTheDocument());
    expect(mockSync).toHaveBeenCalledWith('tx_1');
    expect(mockLoad).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('send-to-slot')).toHaveLength(2); // proof of funds + the DIP/offer under mortgage
    expect(screen.queryByRole('link', { name: 'Open ID & AML' })).not.toBeInTheDocument(); // already verified, nothing to do
    expect(screen.getByLabelText('Mortgage')).toBeChecked();
    expect(screen.getByPlaceholderText('e.g. Halifax')).toHaveValue('Halifax');
    expect(screen.getByLabelText('No chain')).toBeChecked();
    expect(screen.getByLabelText('I have received the survey report')).not.toBeChecked();
    expect(screen.getByText('On the audit trail')).toBeInTheDocument();
    expect(screen.getByText('Not yet on the audit trail')).toBeInTheDocument();
  });

  it('saving the mortgage declaration posts type and lender and swaps in the refreshed items', async () => {
    mockParty.mockResolvedValue({ role: 'buyer', side: 'buyer' });
    mockSync.mockResolvedValue([...ITEMS]);
    mockDeclare.mockResolvedValue(ITEMS.map((i) => (i.item === 'mortgage' ? { ...i, status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Nationwide', mortgage_stage: 'dip' }, onLedger: true } : i)));
    renderTab();
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Halifax')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. Halifax'), { target: { value: 'Nationwide' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitFor(() => expect(mockDeclare).toHaveBeenCalledWith('tx_1', { fundingType: 'mortgage', lenderName: 'Nationwide' }));
    await waitFor(() => expect(screen.getByText('3 of 5 ready')).toBeInTheDocument());
    expect(screen.getByText('Mortgage · DIP held · Nationwide')).toBeInTheDocument();
  });

  it('the other side reads the status only: no forms, no help, the sharing note', async () => {
    mockParty.mockResolvedValue({ role: 'conveyancer', side: 'seller' });
    mockLoad.mockResolvedValue([...ITEMS]);
    renderTab();
    await waitFor(() => expect(screen.getByText('2 of 5 ready')).toBeInTheDocument());
    expect(mockSync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('send-to-slot')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByText(/shared only through the Transaction Wallet switches/)).toBeInTheDocument();
    expect(screen.getByText('Mortgage · No DIP or offer sent yet · Halifax')).toBeInTheDocument();
  });

  it('someone who is not a party sees the not-a-party line', async () => {
    mockParty.mockResolvedValue(null);
    renderTab();
    await waitFor(() => expect(screen.getByText(/not a party on this transaction/)).toBeInTheDocument());
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('a read failure is shown, not swallowed', async () => {
    mockParty.mockResolvedValue({ role: 'seller', side: 'seller' });
    mockLoad.mockRejectedValue(new Error('buyer_pack_status: permission denied'));
    renderTab();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission denied'));
  });

  it('an unverified buyer gets the link into the ID & AML tab', async () => {
    mockParty.mockResolvedValue({ role: 'buyer', side: 'buyer' });
    mockSync.mockResolvedValue(ITEMS.map((i) => (i.item === 'id_aml' ? { ...i, status: 'not_started', detail: { aml_state: 'none' }, onLedger: false } : i)));
    renderTab();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Open ID & AML' })).toHaveAttribute('href', '/?tab=aml'));
  });
});
