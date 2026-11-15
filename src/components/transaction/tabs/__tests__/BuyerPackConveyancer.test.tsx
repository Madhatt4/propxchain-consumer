// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BuyerPackItem } from '@/services/buyerPack.service';

const mockParty = vi.fn();
vi.mock('@/services/enquiries.service', () => ({ myPartyOn: (...a: unknown[]) => mockParty(...a) }));
const mockLoad = vi.fn();
const mockSync = vi.fn();
vi.mock('@/services/buyerPack.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/buyerPack.service')>('@/services/buyerPack.service');
  return { ...actual, loadBuyerPack: (...a: unknown[]) => mockLoad(...a), syncBuyerPack: (...a: unknown[]) => mockSync(...a) };
});
vi.mock('../buyerPack/SendToSlot', () => ({ SendToSlot: () => <div data-testid="send-to-slot" /> }));
vi.mock('@/services/chainEntitlement.service', () => ({ isChainUnlocked: () => Promise.resolve(false) }));
import { BuyerPackTab } from '../BuyerPackTab';
import { BUYER_PACK_HELP } from '../buyerPack/buyerPackHelp';

const FIVE: BuyerPackItem[] = [
  { item: 'id_aml', status: 'ready', detail: { aml_state: 'complete' }, onLedger: true, pending: false },
  { item: 'proof_of_funds', status: 'not_started', detail: {}, onLedger: false, pending: false },
  { item: 'mortgage', status: 'in_progress', detail: { funding_type: 'mortgage', mortgage_stage: 'none' }, onLedger: false, pending: false },
  { item: 'chain', status: 'ready', detail: { chain_position: 'none' }, onLedger: true, pending: false },
  { item: 'survey', status: 'not_started', detail: { survey_state: 'none' }, onLedger: false, pending: false },
];
const conv = (status: BuyerPackItem['status'], detail: BuyerPackItem['detail']): BuyerPackItem =>
  ({ item: 'conveyancer', status, detail, onLedger: false, pending: false });
const onGoToStage = vi.fn();
const renderTab = () => render(<MemoryRouter><BuyerPackTab transactionId="tx_1" onGoToStage={onGoToStage} /></MemoryRouter>);
const asBuyer = (items: BuyerPackItem[]) => {
  mockParty.mockResolvedValue({ role: 'buyer', side: 'buyer' });
  mockSync.mockResolvedValue(items);
};
const asSeller = (items: BuyerPackItem[]) => {
  mockParty.mockResolvedValue({ role: 'seller', side: 'seller' });
  mockLoad.mockResolvedValue(items);
};

describe('BuyerPackTab conveyancer item', () => {
  beforeEach(() => { mockParty.mockReset(); mockLoad.mockReset(); mockSync.mockReset(); onGoToStage.mockReset(); });

  it.each([
    ['none', 'not_started', 'Not chosen yet'],
    ['requested', 'in_progress', 'Estimates requested'],
    ['received', 'in_progress', 'Estimates received, none accepted yet'],
  ] as const)('should render the conveyancer row 6th with the %s state line', async (state, status, line) => {
    asBuyer([...FIVE, conv(status, { estimate_state: state })]);
    renderTab();
    const rows = within(await screen.findByRole('list', { name: 'Buyer pack steps' })).getAllByRole('listitem');
    expect(rows).toHaveLength(6);
    expect(rows[5]).toHaveTextContent('Conveyancer chosen');
    expect(rows[5]).toHaveTextContent(line);
  });

  it('should show the firm name when ready and no audit-trail line for it', async () => {
    asBuyer([...FIVE, conv('ready', { estimate_state: 'accepted', firm_name: 'Smith & Co' })]);
    renderTab();
    const row = await screen.findByTestId('pack-item-conveyancer');
    expect(row).toHaveTextContent('Chosen: Smith & Co');
    expect(row).not.toHaveTextContent(/audit trail/);
    expect(screen.getAllByText(/audit trail/)).toHaveLength(2); // the two other ready rows keep theirs
  });

  it('should give the buyer the Request estimates action and the verbatim help', async () => {
    asBuyer([...FIVE, conv('not_started', { estimate_state: 'none' })]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Request estimates/ }));
    expect(onGoToStage).toHaveBeenCalledWith('buyer-5');
    fireEvent.click(screen.getByRole('button', { name: 'What is Conveyancer chosen?' }));
    const h = BUYER_PACK_HELP.conveyancer;
    [h.what, h.where, h.cost, h.who].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  });

  it.each(['requested', 'received'] as const)('should offer View estimates once estimates are %s', async (state) => {
    asBuyer([...FIVE, conv('in_progress', { estimate_state: state })]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /View estimates/ }));
    expect(onGoToStage).toHaveBeenCalledWith('buyer-5');
    expect(screen.queryByRole('button', { name: /Request estimates/ })).not.toBeInTheDocument();
  });

  it('should not claim the pack is complete when it has no items', async () => {
    asBuyer([]);
    renderTab();
    expect(await screen.findByText('Nothing to show yet.')).toBeInTheDocument();
    expect(screen.queryByText('Pack complete')).not.toBeInTheDocument();
  });

  it('should hide the action once the conveyancer is chosen', async () => {
    asBuyer([...FIVE, conv('ready', { estimate_state: 'accepted', firm_name: 'Smith & Co' })]);
    renderTab();
    await screen.findByTestId('pack-item-conveyancer');
    expect(screen.queryByRole('button', { name: /Request estimates/ })).not.toBeInTheDocument();
  });

  it('should show the seller a tick and the line only, with no action or help', async () => {
    asSeller([...FIVE, conv('ready', { estimate_state: 'accepted', firm_name: 'Smith & Co' })]);
    renderTab();
    const row = await screen.findByTestId('pack-item-conveyancer');
    expect(row).toHaveTextContent('Chosen: Smith & Co');
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('should still render a five-item payload from a server that has no conveyancer row', async () => {
    asSeller(FIVE);
    renderTab();
    await waitFor(() => expect(screen.getByText('2 of 5 ready')).toBeInTheDocument());
    expect(screen.queryByTestId('pack-item-conveyancer')).not.toBeInTheDocument();
  });
});
