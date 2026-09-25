// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import type { BuyerPackItem } from '@/services/buyerPack.service';
import { describeItem, statusLabel } from '../buyerPackLabels';

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
});
