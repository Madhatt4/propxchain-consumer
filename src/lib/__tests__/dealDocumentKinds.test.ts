// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { dealDocGroup, dealDocTypeLabel } from '../dealDocumentKinds';

describe('dealDocGroup', () => {
  it.each([
    ['ta6_attachment', 'forms'],
    ['ta6PropertyInformationForm', 'forms'],
    ['ta10FittingsContents', 'forms'],
    ['ta7', 'forms'],
    ['ta7_leasehold', 'forms'],
    ['property-searches', 'searches'],
    ['local-search', 'searches'],
    ['surveyReport', 'survey'],
    ['sales_pack_floor_plan', 'sales-pack'],
    ['sales_pack_title_plan', 'sales-pack'],
    ['energyPerformanceCertificate', 'sales-pack'],
    ['fensa', 'sales-pack'],
    ['hmlr-register-extract', 'title'],
    ['titleDeeds', 'title'],
    ['tr1_transfer', 'transfer'],
    ['ap1', 'transfer'],
  ])('should put %s in the %s group', (docType, group) => {
    expect(dealDocGroup(docType)).toBe(group);
  });

  it.each([
    'proofOfFunds', 'proof-of-funds', 'mortgageAgreement', 'mortgage_valuation_survey',
    'proof_of_identity', 'passport', 'proofOfAddress', 'aml_check', 'bank_statement',
    'bank_transfer', 'buyer-id', 'gift_letter', 'payslip', 'wallet_slot_passport',
    'completion_statement', 'pii_certificate', 'something_new', '',
  ])('should treat %s as personal and never list it', (docType) => {
    expect(dealDocGroup(docType)).toBeNull();
  });
});

describe('dealDocTypeLabel', () => {
  it('should use the known label for a stored docType', () => {
    expect(dealDocTypeLabel('surveyReport')).toBe('Survey report');
  });

  it('should build a readable label from an unlisted docType', () => {
    expect(dealDocTypeLabel('sales_pack_gas_safety')).toBe('Gas safety');
  });
});
