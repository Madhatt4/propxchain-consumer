// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import type { BuyerPackItem } from '@/services/buyerPack.service';
import { describeItem, itemLabel, sortPackItems, statusLabel } from '../buyerPackLabels';

const item = (over: Partial<BuyerPackItem> & Pick<BuyerPackItem, 'item'>): BuyerPackItem =>
  ({ status: 'not_started', detail: {}, onLedger: false, pending: false, ...over });

describe('buyerPackLabels', () => {
  it('statusLabel maps the three states', () => {
    expect(statusLabel('ready')).toBe('Ready');
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusLabel('not_started')).toBe('Not started');
  });

  it('the mortgage line names type, stage and lender, never an amount', () => {
    expect(describeItem(item({ item: 'mortgage', status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Halifax', mortgage_stage: 'dip' } }))).toBe('Mortgage · DIP held · Halifax');
    expect(describeItem(item({ item: 'mortgage', status: 'in_progress', detail: { funding_type: 'mortgage', mortgage_stage: 'none' } }))).toBe('Mortgage · No DIP or offer sent yet');
    expect(describeItem(item({ item: 'mortgage', status: 'ready', detail: { funding_type: 'mortgage', lender_name: 'Halifax', mortgage_stage: 'offer', offer_expires_on: '2027-03-31' } }))).toBe('Mortgage · Offer held · Halifax · expires 31 March 2027');
    expect(describeItem(item({ item: 'mortgage', status: 'ready', detail: { funding_type: 'cash' } }))).toBe('Cash · funds evidenced');
    expect(describeItem(item({ item: 'mortgage', status: 'in_progress', detail: { funding_type: 'cash' } }))).toBe('Cash · proof of funds still needed');
    expect(describeItem(item({ item: 'mortgage' }))).toBe('Not declared');
  });

  it('the chain line says it is the buyer’s declaration', () => {
    expect(describeItem(item({ item: 'chain', status: 'ready', detail: { chain_position: 'none' } }))).toBe('No chain (buyer’s declaration)');
    expect(describeItem(item({ item: 'chain' }))).toBe('Not declared');
  });

  it('a failed AML check is explained, not hidden', () => {
    expect(describeItem(item({ item: 'id_aml', detail: { aml_state: 'failed' } }))).toContain('failed');
    expect(describeItem(item({ item: 'id_aml', status: 'ready', detail: { aml_state: 'complete' } }))).toBe('Verified');
    expect(describeItem(item({ item: 'id_aml', status: 'in_progress', detail: { aml_state: 'pending' } }))).toBe('Check in progress');
  });

  it('survey and proof of funds read from the state', () => {
    expect(describeItem(item({ item: 'survey', status: 'in_progress', detail: { survey_state: 'booked' } }))).toBe('Booked');
    expect(describeItem(item({ item: 'survey', status: 'ready', detail: { survey_state: 'received' } }))).toBe('Report received');
    expect(describeItem(item({ item: 'proof_of_funds', status: 'ready' }))).toBe('Funds evidenced');
  });

  it('should sort known ids into the signed-off order and unknown ids last', () => {
    const ids = ['conveyancer', 'survey', 'x_new', 'id_aml', 'chain', 'proof_of_funds', 'mortgage'];
    const sorted = sortPackItems(ids.map((id) => item({ item: id as BuyerPackItem['item'] })));
    expect(sorted.map((i) => i.item)).toEqual(['chain', 'mortgage', 'proof_of_funds', 'id_aml', 'survey', 'conveyancer', 'x_new']);
  });

  it('should describe the conveyancer item from its estimate state and firm name', () => {
    const c = (status: BuyerPackItem['status'], detail: BuyerPackItem['detail']): string => describeItem(item({ item: 'conveyancer', status, detail }));
    expect(c('ready', { estimate_state: 'accepted', firm_name: 'Smith & Co' })).toBe('Chosen: Smith & Co');
    expect(c('ready', { estimate_state: 'accepted' })).toBe('Chosen');
    expect(c('in_progress', { estimate_state: 'received' })).toBe('Estimates received, none accepted yet');
    expect(c('in_progress', { estimate_state: 'requested' })).toBe('Estimates requested');
    expect(c('not_started', { estimate_state: 'none' })).toBe('Not chosen yet');
    expect(c('not_started', {})).toBe('Not chosen yet');
  });

  it('should fall back to a readable title and the status for an unknown id', () => {
    const unknown = item({ item: 'x_new' as BuyerPackItem['item'], status: 'in_progress' });
    expect(itemLabel('x_new')).toBe('x new');
    expect(describeItem(unknown)).toBe('In progress');
  });
});
