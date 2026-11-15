// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
import { BUYER_PACK_HELP } from '../buyerPack/buyerPackHelp';

const ITEMS = [
  { item: 'id_aml', status: 'ready', detail: { aml_state: 'complete' }, onLedger: true, pending: false },
  { item: 'proof_of_funds', status: 'not_started', detail: {}, onLedger: false, pending: false },
  { item: 'mortgage', status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Halifax', mortgage_stage: 'none' }, onLedger: false, pending: false },
  { item: 'chain', status: 'ready', detail: { chain_position: 'none' }, onLedger: false, pending: true },
  { item: 'survey', status: 'not_started', detail: { survey_state: 'none' }, onLedger: false, pending: false },
] as const;
const onGoToStage = vi.fn();
const props = { transactionId: 'tx_1', onGoToStage };
const renderTab = () => render(<MemoryRouter><BuyerPackTab {...props} /></MemoryRouter>);
const TITLES = ['Chain position', 'Mortgage or cash', 'Proof of funds', 'ID and anti-money-laundering check', 'Survey', 'Conveyancer chosen'];
const asBuyer = (items: readonly unknown[] = ITEMS) => {
  mockParty.mockResolvedValue({ role: 'buyer', side: 'buyer' });
  mockSync.mockResolvedValue([...items]);
};

describe('BuyerPackTab', () => {
  beforeEach(() => { mockParty.mockReset(); mockLoad.mockReset(); mockSync.mockReset(); mockDeclare.mockReset(); onGoToStage.mockReset(); });

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
    fireEvent.click(within(screen.getByTestId('pack-item-mortgage')).getByRole('button', { name: 'Save' }));
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

  it('should list the rows in the signed-off order, numbered, with a tick for each ready one', async () => {
    asBuyer();
    renderTab();
    await waitFor(() => expect(screen.getByText('2 of 5 ready')).toBeInTheDocument());
    const rows = within(screen.getByRole('list', { name: 'Buyer pack steps' })).getAllByRole('listitem');
    TITLES.slice(0, 5).forEach((t, i) => expect(rows[i]).toHaveTextContent(t));
    expect(rows[1]).toHaveTextContent('2'); // mortgage still to do: number shown
    expect(rows[0]).not.toHaveTextContent(/^1/); // chain ready: tick replaces the number
    expect(rows[3]).not.toHaveTextContent(/^4/); // id_aml ready
  });

  it('should send an unknown item id to the end and render it with fallback text', async () => {
    asBuyer([{ item: 'x_new', status: 'not_started', detail: {}, onLedger: false, pending: false }, ...ITEMS]);
    renderTab();
    await waitFor(() => expect(screen.getByText('2 of 6 ready')).toBeInTheDocument());
    const rows = within(screen.getByRole('list', { name: 'Buyer pack steps' })).getAllByRole('listitem');
    expect(rows).toHaveLength(6);
    expect(rows[5]).toHaveTextContent('x new');
    expect(rows[5]).toHaveTextContent('Not started');
    expect(within(rows[5]).queryByRole('button', { name: /What is/ })).not.toBeInTheDocument();
  });

  it('should name the first not-ready step as Next, then say Pack complete when all are ready', async () => {
    asBuyer();
    renderTab();
    expect(await screen.findByText('Next: Mortgage or cash')).toBeInTheDocument();
  });

  it('should say Pack complete when every item is ready', async () => {
    asBuyer(ITEMS.map((i) => ({ ...i, status: 'ready' })));
    renderTab();
    expect(await screen.findByText('Pack complete')).toBeInTheDocument();
  });

  // The conveyancer help is exercised in BuyerPackConveyancer.test.tsx (this fixture is the five-item payload).
  it.each(Object.entries(BUYER_PACK_HELP).filter(([id]) => id !== 'conveyancer'))('should open the four labelled help lines for %s with the signed-off text', async (id, help) => {
    asBuyer();
    renderTab();
    const title = TITLES[['chain', 'mortgage', 'proof_of_funds', 'id_aml', 'survey', 'conveyancer'].indexOf(id)];
    const btn = await screen.findByRole('button', { name: `What is ${title}?` });
    expect(screen.queryByText(help.what)).not.toBeInTheDocument();
    fireEvent.click(btn);
    for (const label of ['What it is', 'Where you get it', 'Cost', 'Who usually does it']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    [help.what, help.where, help.cost, help.who].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    fireEvent.click(btn);
    expect(screen.queryByText(help.what)).not.toBeInTheDocument();
  });

  it('should send the buyer to the Property Survey stage from the survey action', async () => {
    asBuyer();
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Choose a survey/ }));
    expect(onGoToStage).toHaveBeenCalledWith('buyer-3');
  });

  it('should show the seller ticks, titles and result lines but no help, actions or controls', async () => {
    mockParty.mockResolvedValue({ role: 'conveyancer', side: 'seller' });
    mockLoad.mockResolvedValue([...ITEMS].reverse());
    renderTab();
    await waitFor(() => expect(screen.getByText('2 of 5 ready')).toBeInTheDocument());
    TITLES.slice(0, 5).forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.getByText('No chain (buyer’s declaration)')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /What is/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose a survey/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open ID/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('On the audit trail')).toBeInTheDocument();
  });
});
