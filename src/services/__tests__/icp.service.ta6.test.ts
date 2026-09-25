import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pass-through rate limiter so we test the method logic directly
vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// icp.service only reads these two accessors from the auth store; mocking the
// store keeps its transitive supabase client (which needs VITE_SUPABASE_* env
// at import time) out of the test.
vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: (): string | null => null,
  getStoreIsAuthenticated: (): boolean => false,
}));

import { Principal } from '@propxchain/core-client';
import { icpService } from '../icp.service';
import { emptyTA6Form } from '../../types/ta6.types';
import type { TA6PropertyInformation } from '../../types/ta6.types';
import type { CandidTA6PropertyInformation } from '../ta6/ta6Candid.types';

// ── helpers ──────────────────────────────────────────────────────────────────

// toCandidTA6 stamps the anonymous principal (canister overwrites with the
// authenticated caller), so a round-trippable fixture must carry its text.
const ANON_TEXT = Principal.anonymous().toText();

function populateEarlySections(form: TA6PropertyInformation): void {
  form.section1 = {
    propertyAddress: '1 Test Street, Sandy',
    postcode: 'SG19 1AA',
    uprn: '100021300679',
    sellers: [{ fullName: 'Jane Seller', role: 'executor', ownershipOrAuthorityDate: '2020-05-01' }],
    sellerCompany: null,
    solicitor: {
      firmName: 'Firm & Co', address: '2 Law Row, Biggleswade', postcode: 'SG18 0AA',
      contactName: 'Sol Icitor', email: 'sol@firm.example', phone: null,
    },
  };
  form.section2.q2_1Features = [{ position: 'left', ownership: 'shared' }];
  form.section2.q2_3MovedOrAltered = { answer: 'yes', details: 'Rear fence replaced 2019' };
  form.section5.q5_2Documents = [{ status: 'attached', documentId: '42' }];
  form.section6.q6_1NewHomeWarranty = {
    present: 'yes', document: { status: 'to-follow', documentId: null },
  };
  form.section7.q7_1DoYouInsure = 'no';
  form.section7.q7_1WhoInsuresIfNot = 'Freeholder insures the building';
  form.section9.q9_2Contributions = { answer: 'yes', details: 'Shared private road' };
  form.section9.q9_2Amount = 12550; // pence
  form.section9.q9_9Arrangement = {
    description: 'Drain crosses the neighbouring garden', contributionAmount: null,
    document: { status: 'not-available', documentId: null },
  };
}

function populateLateSections(form: TA6PropertyInformation): void {
  form.section10.q10_1Arrangements = ['driveway', 'on-road'];
  form.section11.q11_4HeatingSystems = [{
    heatingType: 'gas-central', otherDetails: null,
    installDate: '2015-01-01', lastServiceDate: '2025-11-14',
    certificate: { status: 'attached', documentId: '7' },
  }];
  form.section11.q11_6SewerageSource = 'septic-tank';
  form.section11.q11_7SewerageSystem = {
    source: 'septic-tank', otherDetails: null, location: 'Rear garden',
    lastServiceDate: '05/2025', dischargeType: 'ground-water',
    infiltrationSystem: 'yes', regulationCompliant: 'not-known',
  };
  form.section12.mainsElectricity = {
    connected: 'yes', provider: 'Octopus',
    meterLocation: 'Hall cupboard', supplyNumber: 'MPAN-123',
  };
  form.section13.q13_7Occupiers = [{
    fullName: 'Tom Occupier', age: 17,
    tenancyAgreement: { status: 'not-applicable', documentId: null },
  }];
}

/** A 6th-edition form exercising every conversion kind (variants, opts,
 *  documents, pence bigints, dates, nested arrays) for the round-trip test. */
function makeFixture(): TA6PropertyInformation {
  const form = emptyTA6Form();
  form.jurisdiction = 'wales';
  populateEarlySections(form);
  populateLateSections(form);
  form.completedBy = ANON_TEXT;
  form.completedAt = '2026-07-01T10:30:00.000Z';
  form.lastModifiedBy = ANON_TEXT;
  form.lastModifiedAt = '2026-07-02T09:00:00.000Z';
  return form;
}

type MockActor = Record<
  | 'updateTA6'
  | 'getTA6'
  | 'runCrossReference'
  | 'getAnomalies'
  | 'acknowledgeTA6Wording'
  | 'hasAcknowledgedTA6Wording',
  ReturnType<typeof vi.fn>
>;

type Internals = { transactionManagerActor: MockActor | null };

async function captureCandid(form: TA6PropertyInformation): Promise<CandidTA6PropertyInformation> {
  const actor = (icpService as unknown as Internals).transactionManagerActor as MockActor;
  actor.updateTA6.mockResolvedValue({ ok: null });
  await icpService.updateTA6('tx-001', form);
  const [, candid] = actor.updateTA6.mock.calls[0] as [string, CandidTA6PropertyInformation];
  return candid;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('icpService TA6 6th-edition canister wrappers', () => {
  let actor: MockActor;

  beforeEach(() => {
    actor = {
      updateTA6: vi.fn(),
      getTA6: vi.fn(),
      runCrossReference: vi.fn(),
      getAnomalies: vi.fn(),
      acknowledgeTA6Wording: vi.fn(),
      hasAcknowledgedTA6Wording: vi.fn(),
    };
    (icpService as unknown as Internals).transactionManagerActor = actor;
  });

  afterEach(() => {
    (icpService as unknown as Internals).transactionManagerActor = null;
  });

  // ── updateTA6 -> getTA6 round trip ─────────────────────────────────────────

  describe('updateTA6 / getTA6 round trip', () => {
    it('should reproduce the UI form exactly after UI -> candid -> UI', async () => {
      const fixture = makeFixture();

      const candid = await captureCandid(fixture);
      actor.getTA6.mockResolvedValue({ ok: [candid] });
      const roundTripped = await icpService.getTA6('tx-001');

      expect(roundTripped).toEqual(fixture);
    });

    it('should send candid conventions: variants, bigints, anonymous principals', async () => {
      const candid = await captureCandid(makeFixture());

      expect(candid.jurisdiction).toEqual({ Wales: null });
      expect(candid.section5.q5_2Documents[0]).toEqual({ Attached: BigInt(42) });
      expect(candid.section9.q9_2Amount).toEqual([BigInt(12550)]);
      expect(candid.section10.q10_1Arrangements).toEqual([{ Driveway: null }, { OnRoad: null }]);
      expect(candid.section13.q13_7Occupiers[0].age).toEqual([BigInt(17)]);
      expect(candid.completedBy.isAnonymous()).toBe(true);
      expect(candid.lastModifiedBy.isAnonymous()).toBe(true);
      expect(candid.completedAt).toEqual([
        BigInt(Date.parse('2026-07-01T10:30:00.000Z')) * BigInt(1_000_000),
      ]);
    });
  });

  // ── draft semantics ────────────────────────────────────────────────────────

  describe('updateTA6 draft mapping', () => {
    it('should map not-answered draft markers to { NotAnswered: null }', async () => {
      const candid = await captureCandid(emptyTA6Form());

      expect(candid.section7.q7_1DoYouInsure).toEqual({ NotAnswered: null });
      expect(candid.section2.q2_3MovedOrAltered).toEqual({
        answer: { NotAnswered: null },
        details: [],
      });
      expect(candid.section8.q8_3aReport).toEqual({ NotAnswered: null });
      expect(candid.section6.q6_1Other).toEqual({
        present: { NotAnswered: null },
        document: { NotAnswered: null },
      });
    });

    it('should map a draft null q11_6SewerageSource to the empty candid optional', async () => {
      const candid = await captureCandid(emptyTA6Form());

      expect(candid.section11.q11_6SewerageSource).toEqual([]);
      expect(candid.section11.q11_7SewerageSystem).toEqual([]);
      expect(candid.section5.q5_6Solar).toEqual([]);
      expect(candid.completedAt).toEqual([]);
      expect(candid.jurisdiction).toEqual({ England: null });
    });

    it('should throw when the canister returns err', async () => {
      actor.updateTA6.mockResolvedValue({ err: 'Access denied' });

      await expect(icpService.updateTA6('tx-001', emptyTA6Form())).rejects.toThrow(
        'Access denied'
      );
    });
  });

  // ── getTA6 ────────────────────────────────────────────────────────────────

  describe('getTA6', () => {
    it('should return null when the canister returns the empty optional', async () => {
      actor.getTA6.mockResolvedValue({ ok: [] });

      await expect(icpService.getTA6('tx-001')).resolves.toBeNull();
    });

    it('should throw when the canister returns err', async () => {
      actor.getTA6.mockResolvedValue({ err: 'Not found' });

      await expect(icpService.getTA6('tx-001')).rejects.toThrow('Not found');
    });
  });

  // ── cross-reference ───────────────────────────────────────────────────────

  describe('runCrossReference', () => {
    it('should return the anomaly count as a plain number', async () => {
      actor.runCrossReference.mockResolvedValue({ ok: BigInt(3) });

      await expect(icpService.runCrossReference('tx-001')).resolves.toBe(3);
      expect(actor.runCrossReference).toHaveBeenCalledWith('tx-001');
    });

    it('should throw when the canister returns err', async () => {
      actor.runCrossReference.mockResolvedValue({ err: 'Premium required' });

      await expect(icpService.runCrossReference('tx-001')).rejects.toThrow('Premium required');
    });
  });

  describe('getAnomalies', () => {
    it('should map severity variants to lowercase strings and bigint time to ISO', async () => {
      const detectedAtNs = BigInt(Date.parse('2026-07-02T12:00:00.000Z')) * BigInt(1_000_000);
      actor.getAnomalies.mockResolvedValue({
        ok: [{
          ref: 'ta6.q8_1 vs searches.floodRisk',
          explanation: 'TA6 says never flooded; search reports flood zone 3',
          detectedAt: detectedAtNs,
          sources: ['ta6.section8.q8_1Flooded', 'searches.floodRisk'],
          severity: { Conflict: null },
        }],
      });

      const anomalies = await icpService.getAnomalies('tx-001');

      expect(anomalies).toEqual([{
        ref: 'ta6.q8_1 vs searches.floodRisk',
        severity: 'conflict',
        sources: ['ta6.section8.q8_1Flooded', 'searches.floodRisk'],
        explanation: 'TA6 says never flooded; search reports flood zone 3',
        detectedAt: '2026-07-02T12:00:00.000Z',
      }]);
    });

    it('should throw when the canister returns err', async () => {
      actor.getAnomalies.mockResolvedValue({ err: 'Access denied' });

      await expect(icpService.getAnomalies('tx-001')).rejects.toThrow('Access denied');
    });
  });

  // ── wording acknowledgement ───────────────────────────────────────────────

  describe('acknowledgeTA6Wording', () => {
    it('should resolve when the canister returns ok', async () => {
      actor.acknowledgeTA6Wording.mockResolvedValue({ ok: null });

      await expect(icpService.acknowledgeTA6Wording('tx-001')).resolves.toBeUndefined();
      expect(actor.acknowledgeTA6Wording).toHaveBeenCalledWith('tx-001');
    });

    it('should throw when the canister returns err', async () => {
      actor.acknowledgeTA6Wording.mockResolvedValue({ err: 'Not a participant' });

      await expect(icpService.acknowledgeTA6Wording('tx-001')).rejects.toThrow(
        'Not a participant'
      );
    });
  });

  describe('hasAcknowledgedTA6Wording', () => {
    it('should pass through the bare canister boolean', async () => {
      actor.hasAcknowledgedTA6Wording.mockResolvedValue(true);
      await expect(icpService.hasAcknowledgedTA6Wording('tx-001')).resolves.toBe(true);

      actor.hasAcknowledgedTA6Wording.mockResolvedValue(false);
      await expect(icpService.hasAcknowledgedTA6Wording('tx-001')).resolves.toBe(false);
    });
  });
});
