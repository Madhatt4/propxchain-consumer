// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Redaction contract for the public pack view (decision:
 * Madhatt4/Propxchain#116): TA6/TA10 are included with the seller-personal
 * fields of TA6 section 1 redacted — seller names, company director, the
 * solicitor's personal contact — and completion principals stripped. The
 * property facts and every question answer survive untouched.
 *
 * Canary style: every personal value is a distinctive string, and the tests
 * assert the SERIALISED output never contains it — so a future field rename
 * that bypasses the redactor fails loudly here.
 */
import { describe, it, expect } from 'vitest';

import { redactTa6ForSharing, redactTa10ForSharing } from '../packRedaction';
import type { TA6PropertyInformation } from '@/types/ta6.types';
import type { TA10FittingsAndContents } from '@/types/ta10.types';

const CANARIES = [
  'Marjorie Canary',
  'Derek Canary Director',
  'Sally Canary Solicitor',
  'canary@example.com',
  '07700 900123',
  'principal-canary-aaaaa',
];

const ta6 = {
  formVersion: 'v6_2025_09_01',
  jurisdiction: 'englandWales',
  section1: {
    propertyAddress: '12 High Street, Sandy',
    postcode: 'SG19 1AB',
    uprn: '10000802117',
    sellers: [
      { fullName: 'Marjorie Canary', role: 'owner', ownershipOrAuthorityDate: '2015-03-01' },
    ],
    sellerCompany: {
      companyName: 'Canary Homes Ltd',
      companyNumber: '01234567',
      director: 'Derek Canary Director',
      countryOfIncorporation: 'England',
    },
    solicitor: {
      firmName: 'Bedford Conveyancing LLP',
      address: '1 Mill Lane, Bedford',
      postcode: 'MK40 1AA',
      contactName: 'Sally Canary Solicitor',
      email: 'canary@example.com',
      phone: '07700 900123',
    },
  },
  section2: {
    q2_1Features: [{ position: 'left', ownership: 'ours' }],
    q2_2IrregularDescription: 'The hedge follows the stream',
    q2_3MovedOrAltered: { answer: 'no' },
  },
  completedBy: 'principal-canary-aaaaa',
  lastModifiedBy: 'principal-canary-aaaaa',
} as unknown as TA6PropertyInformation;

const ta10 = {
  rooms: [
    {
      roomName: 'Kitchen',
      fittings: [{ item: 'Oven/Hob', included: true, notes: 'Bosch, staying' }],
    },
  ],
  outdoorItems: [{ item: 'Shed', included: false, notes: null }],
  additionalItems: 'Log store by the gate',
  completedBy: 'principal-canary-aaaaa',
  completedAt: '2026-08-01T10:00:00Z',
  lastModifiedBy: 'principal-canary-aaaaa',
  lastModifiedAt: '2026-08-01T10:00:00Z',
} as unknown as TA10FittingsAndContents;

describe('redactTa6ForSharing', () => {
  it('should remove every personal canary from the serialised output', () => {
    const out = JSON.stringify(redactTa6ForSharing(ta6));
    for (const canary of CANARIES) {
      expect(out).not.toContain(canary);
    }
  });

  it('should keep the property identity fields', () => {
    const out = redactTa6ForSharing(ta6);
    expect(out.section1.propertyAddress).toBe('12 High Street, Sandy');
    expect(out.section1.postcode).toBe('SG19 1AB');
    expect(out.section1.uprn).toBe('10000802117');
  });

  it('should keep the solicitor firm but not the person', () => {
    const s = redactTa6ForSharing(ta6).section1.solicitor;
    expect(s.firmName).toBe('Bedford Conveyancing LLP');
    expect(s.contactName).toBe('');
    expect(s.email).toBeNull();
    expect(s.phone).toBeNull();
  });

  it('should empty the sellers list and drop the company seller', () => {
    const s1 = redactTa6ForSharing(ta6).section1;
    expect(s1.sellers).toEqual([]);
    expect(s1.sellerCompany).toBeNull();
  });

  it('should leave question answers untouched', () => {
    const out = redactTa6ForSharing(ta6) as unknown as Record<string, unknown>;
    expect(JSON.stringify(out.section2)).toContain('The hedge follows the stream');
  });

  it('should not mutate its input', () => {
    const before = JSON.stringify(ta6);
    redactTa6ForSharing(ta6);
    expect(JSON.stringify(ta6)).toBe(before);
  });
});

describe('redactTa10ForSharing', () => {
  it('should remove the principals but keep the inventory', () => {
    const out = redactTa10ForSharing(ta10);
    const s = JSON.stringify(out);
    expect(s).not.toContain('principal-canary-aaaaa');
    expect(s).toContain('Bosch, staying');
    expect(s).toContain('Log store by the gate');
  });

  it('should not mutate its input', () => {
    const before = JSON.stringify(ta10);
    redactTa10ForSharing(ta10);
    expect(JSON.stringify(ta10)).toBe(before);
  });
});
