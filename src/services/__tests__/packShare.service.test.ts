// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The assembled public snapshot must never carry a person: no title
 * proprietors, no TA6 seller/solicitor identities, no principals. Canary
 * values assert on the SERIALISED snapshot so any future field addition
 * that routes personal data past the redactors fails here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { assemblePackSnapshot } from '../packShare.service';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

vi.mock('../salesPackReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../salesPackReadiness')>();
  return {
    ...actual,
    loadPackReadinessInputs: vi.fn().mockResolvedValue({
      listing: {
        address: '12 High Street, Sandy',
        postcode: 'SG19 1AB',
        price: 400000,
        tenure: 'freehold',
        propertyType: 'Detached',
        epcRating: 'C',
        councilTaxBand: 'D',
        uprn: '10000802117',
      },
      titlePulled: true,
      searchesOrdered: true,
      searchesBack: true,
      ta6: true,
      ta10: true,
      ta7: false,
      idShared: true,
    }),
  };
});

vi.mock('../hmlrTitle.service', () => ({
  hmlrTitleService: {
    getStoredRegisterForTransaction: vi.fn().mockResolvedValue({
      titleNumber: 'BD123456',
      registeredAddress: '12 High Street, Sandy',
      classOfTitle: 'Absolute',
      tenure: 'Freehold',
      editionDate: '2026-05-01',
      proprietors: ['Priscilla Proprietor Canary'],
      charges: [{ chargee: 'Big Bank plc' }],
      hasCharges: true,
      hasRestrictions: false,
      hasCautions: false,
      hasNotices: false,
      leaseCount: 0,
    }),
  },
}));

vi.mock('../onesearchResults', () => ({
  fetchReturnedOneSearchResults: vi.fn().mockResolvedValue([
    { id: '1', ourReference: 'ref', supplierReference: 'sup', productCodes: ['LLC1'], returnedAt: '2026-08-10T09:00:00Z', bundle: {} },
  ]),
}));

vi.mock('../icp.service', () => ({
  icpService: {
    getTA6: vi.fn().mockResolvedValue({
      formVersion: 'v6',
      section1: {
        propertyAddress: '12 High Street, Sandy',
        postcode: 'SG19 1AB',
        uprn: '10000802117',
        sellers: [{ fullName: 'Marjorie Canary', role: 'owner', ownershipOrAuthorityDate: null }],
        sellerCompany: null,
        solicitor: {
          firmName: 'Bedford Conveyancing LLP',
          address: '1 Mill Lane',
          postcode: 'MK40 1AA',
          contactName: 'Sally Canary Solicitor',
          email: 'canary@example.com',
          phone: '07700 900123',
        },
      },
      lastModifiedAt: '2026-08-01T10:00:00Z',
      completedBy: 'principal-canary-aaaaa',
      lastModifiedBy: 'principal-canary-aaaaa',
    }),
    getTA10: vi.fn().mockResolvedValue({
      rooms: [],
      outdoorItems: [],
      additionalItems: '',
      completedBy: 'principal-canary-aaaaa',
      completedAt: null,
      lastModifiedBy: 'principal-canary-aaaaa',
      lastModifiedAt: '2026-08-01T10:00:00Z',
    }),
    ledgerManager: undefined,
  },
}));

vi.mock('../web2-document.service', () => ({
  web2DocumentService: {
    getDocumentsByTransaction: vi.fn().mockResolvedValue([
      { id: '1', documentType: 'sales_pack_extra', fileName: 'floorplan.pdf' },
      { id: '3', documentType: 'sales_pack_gas_safety', fileName: 'gas.pdf' },
      { id: '2', documentType: 'ta6', fileName: 'should-not-appear.pdf' },
      { id: '4', documentType: 'passport', fileName: 'passport-must-never-appear.jpg' },
    ]),
  },
}));

const PERSONAL_CANARIES = [
  'Priscilla Proprietor Canary',
  'Marjorie Canary',
  'Sally Canary Solicitor',
  'canary@example.com',
  '07700 900123',
  'principal-canary-aaaaa',
];

describe('assemblePackSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should never serialise a person into the snapshot', async () => {
    const s = JSON.stringify(await assemblePackSnapshot('tx-1'));
    for (const canary of PERSONAL_CANARIES) {
      expect(s).not.toContain(canary);
    }
  });

  it('should carry the proprietor-free title summary', async () => {
    const snap = await assemblePackSnapshot('tx-1');
    expect(snap.titleSummary).toEqual({
      titleNumber: 'BD123456',
      classOfTitle: 'Absolute',
      tenure: 'Freehold',
      editionDate: '2026-05-01',
      hasCharges: true,
      hasRestrictions: false,
    });
  });

  it('should include only sales-pack documents, names and kind only, never ID', async () => {
    const snap = await assemblePackSnapshot('tx-1');
    expect(snap.extraDocuments).toEqual([
      { fileName: 'floorplan.pdf', kind: 'Other' },
      { fileName: 'gas.pdf', kind: 'Gas safety certificate' },
    ]);
  });

  it('should mark on-chain items verified and carry search return facts', async () => {
    const snap = await assemblePackSnapshot('tx-1');
    expect(snap.items.find((i) => i.id === 'ta6')?.verification?.verified).toBe(true);
    expect(snap.items.find((i) => i.id === 'titlePulled')?.verification?.verified).toBe(true);
    expect(snap.searches).toMatchObject({ ordered: true, back: true, returnedAt: '2026-08-10T09:00:00Z' });
  });

  it('should keep the solicitor firm visible through the redacted TA6', async () => {
    const snap = await assemblePackSnapshot('tx-1');
    expect(snap.ta6?.section1.solicitor.firmName).toBe('Bedford Conveyancing LLP');
    expect(snap.ta6?.section1.sellers).toEqual([]);
  });
});
