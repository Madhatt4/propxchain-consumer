// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { emptyTA6Form } from '@/types/ta6.types';
import type { TA6PropertyInformation } from '@/types/ta6.types';
import { emptyTA7Form } from '@/types/ta7.types';
import type { TA7LeaseholdInformation } from '@/types/ta7.types';

vi.mock('@/utils/rightmoveStorage', () => ({
  syncListingFromChain: vi.fn(async () => null),
  getTitleNumber: vi.fn(() => null),
}));
vi.mock('../hmlrTitle.service', () => ({
  hmlrTitleService: {
    getStoredRegisterForTransaction: vi.fn(async () => null),
    findPullByTitleNumber: vi.fn(async () => null),
  },
}));
vi.mock('../searchOrder.service', () => ({
  searchOrderService: { getOrdersForTransaction: vi.fn(async () => []) },
}));
vi.mock('../onesearchResults', () => ({
  fetchReturnedOneSearchResults: vi.fn(async () => []),
}));
vi.mock('../documentShare.service', () => ({
  documentShareService: { listMyGrants: vi.fn(async () => []) },
}));
vi.mock('../icp.service', () => ({
  icpService: {
    getTA6: vi.fn(async () => savedTa6),
    getTA10: vi.fn(async () => null),
    getTA7: vi.fn(async () => savedTa7),
    ledgerManager: { getEventsByTransaction: vi.fn(async () => []) },
  },
}));

import { computePackReadiness, loadPackReadinessInputs, type PackReadinessInputs } from '../salesPackReadiness';

let savedTa6: TA6PropertyInformation | null = null;
let savedTa7: TA7LeaseholdInformation | null = null;

const UNANSWERED = 'not-answered';
const ANSWERED = 'yes';

function answerEverything(value: unknown): unknown {
  if (value === UNANSWERED) return ANSWERED;
  if (Array.isArray(value)) return value.map(answerEverything);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, answerEverything(v)]));
  }
  return value;
}

function ta6WithOnlySection1(): TA6PropertyInformation {
  const form = emptyTA6Form();
  form.section1.propertyAddress = '12 High Street';
  form.section1.sellers = [{ fullName: 'A Seller', role: 'seller', ownershipOrAuthorityDate: null }];
  return form;
}

function fullyAnsweredTa6(): TA6PropertyInformation {
  return answerEverything(ta6WithOnlySection1()) as TA6PropertyInformation;
}

function completeTa7(): TA7LeaseholdInformation {
  const form: TA7LeaseholdInformation = {
    ...emptyTA7Form,
    leaseTermYears: 125,
    leaseStartDate: '2001-01-01',
    leaseExpiryDate: '2126-01-01',
    groundRentPaymentFrequency: 'annual',
    serviceChargePaymentFrequency: 'monthly',
    freeholder: 'Freeholder Ltd',
    restrictions: 'None',
  };
  return form;
}

function baseInputs(overrides: Partial<PackReadinessInputs>): PackReadinessInputs {
  return {
    listing: null,
    titlePulled: false,
    searchesOrdered: false,
    searchesBack: false,
    ta6: false,
    ta10: false,
    ta7: false,
    idShared: false,
    registerDiscrepancies: [],
    ...overrides,
  };
}

function rowStatus(inputs: PackReadinessInputs, id: string): string | undefined {
  return computePackReadiness(inputs).items.find((i) => i.id === id)?.status;
}

beforeEach(() => {
  savedTa6 = null;
  savedTa7 = null;
});

describe('readiness: TA6 counts only when every section is complete', () => {
  it('should not mark TA6 done when only section 1 has been saved', async () => {
    savedTa6 = ta6WithOnlySection1();

    const inputs = await loadPackReadinessInputs('tx-1');

    expect(inputs.ta6).toBe(false);
    expect(inputs.ta6Progress?.sectionsDone).toBeGreaterThanOrEqual(1);
    expect(inputs.ta6Progress?.sectionsDone).toBeLessThan(inputs.ta6Progress?.sectionsTotal ?? 0);
  });

  it('should mark TA6 done when every section is answered', async () => {
    savedTa6 = fullyAnsweredTa6();

    const inputs = await loadPackReadinessInputs('tx-1');

    expect(inputs.ta6).toBe(true);
    expect(inputs.ta6Progress?.sectionsDone).toBe(inputs.ta6Progress?.sectionsTotal);
  });

  it('should leave TA6 not done with no progress when nothing is saved', async () => {
    const inputs = await loadPackReadinessInputs('tx-1');

    expect(inputs.ta6).toBe(false);
    expect(inputs.ta6Progress).toBeUndefined();
  });
});

describe('readiness: TA6 row wording', () => {
  it('should show how many sections are done while the form is part-filled', () => {
    const status = rowStatus(baseInputs({ ta6Progress: { sectionsDone: 1, sectionsTotal: 15 } }), 'ta6');

    expect(status).toBe('In progress: 1 of 15 sections');
  });

  it('should say Not started when nothing is saved', () => {
    expect(rowStatus(baseInputs({}), 'ta6')).toBe('Not started');
  });

  it('should say Completed only when the form is complete', () => {
    const status = rowStatus(baseInputs({ ta6: true, ta6Progress: { sectionsDone: 15, sectionsTotal: 15 } }), 'ta6');

    expect(status).toBe('Completed');
  });
});

describe('readiness: TA7 counts only when its required fields are filled', () => {
  it('should not mark a saved but empty TA7 done', async () => {
    savedTa7 = { ...emptyTA7Form };

    const inputs = await loadPackReadinessInputs('tx-1');

    expect(inputs.ta7).toBe(false);
    expect(inputs.ta7Started).toBe(true);
  });

  it('should mark a fully filled TA7 done', async () => {
    savedTa7 = completeTa7();

    const inputs = await loadPackReadinessInputs('tx-1');

    expect(inputs.ta7).toBe(true);
  });

  it('should show In progress for a started TA7', () => {
    const status = rowStatus(baseInputs({ ta7Started: true }), 'ta7');

    expect(status).toBe('In progress');
  });
});
