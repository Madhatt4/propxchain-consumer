import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDL } from '@dfinity/candid';

const getMyLogbooksQuery = vi.fn();
const createActor = vi.fn(() => ({ getMyLogbooks: getMyLogbooksQuery }));
const getAuthenticatedAgent = vi.fn();

// Partial mock: stub the actor machinery but keep the real Principal so the
// Candid round-trip test can encode an owner value.
vi.mock('@propxchain/core-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@propxchain/core-client')>();
  return {
    ...actual,
    Actor: { createActor: (...args: unknown[]) => createActor(...(args as [])) },
    HttpAgent: vi.fn().mockImplementation(function HttpAgentMock() {
      return {};
    }),
  };
});

vi.mock('../icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAuthenticatedAgent: (...a: unknown[]) => getAuthenticatedAgent(...a),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { Principal } from '@propxchain/core-client';
import {
  getMyLogbooks,
  logbookViewType,
  convertLogbook,
  type CandidIdl,
  type RawLogbookView,
} from '../logbook.service';
import { describeEntry } from '../../types/logbook.types';

// Motoko Time.now() is nanoseconds since epoch. Midday UTC keeps the en-GB
// date stable regardless of the test machine's timezone.
const AUG_14_2026_NS = BigInt(Date.UTC(2026, 7, 14, 12, 0, 0)) * 1_000_000n;

const rawFixture = (owner: RawLogbookView['owner']): RawLogbookView => ({
  uprn: '100081152294',
  owner,
  createdAt: AUG_14_2026_NS,
  entries: [
    {
      id: 0n,
      claim: {
        propertyIdentity: {
          uprn: '100081152294',
          addressLine: '12 Ivel Road',
          postcode: 'SG19 1AB',
          propertyType: 'Detached house',
        },
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: ['tx-1'],
      evidence: { systemDerived: null },
    },
    {
      id: 1n,
      claim: {
        priceEvent: { kind: { sold: null }, pricePence: 40_000_000n, occurredAt: AUG_14_2026_NS },
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: ['tx-1'],
      evidence: { onchainAnchor: null },
    },
    {
      id: 2n,
      claim: {
        documentAnchor: {
          docType: 'TA6',
          sha256: `${'f'.repeat(60)}ab12`,
          validUntil: [],
          anchoredAt: AUG_14_2026_NS,
        },
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: [],
      evidence: { onchainAnchor: null },
    },
    {
      id: 3n,
      claim: {
        searchFact: {
          provider: 'OneSearch',
          productCodes: ['LLC1', 'CON29'],
          orderedAt: [AUG_14_2026_NS],
          resultsReturnedAt: [],
          resultHashes: [],
        },
      },
      recordedAt: AUG_14_2026_NS,
      recordedByTransaction: [],
      evidence: { onchainAnchor: null },
    },
  ],
});

describe('logbook.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('LogbookView Candid round-trip', () => {
    it('should decode an encoded LogbookView fixture and convert it to the domain shape', () => {
      // The hand-written IDL type and the raw TS shape must agree — encode
      // through the real Candid codec and convert what comes back out.
      const viewType = logbookViewType(IDL as unknown as CandidIdl) as unknown as IDL.Type;
      const raw = rawFixture(Principal.anonymous());

      const bytes = IDL.encode([viewType], [raw]);
      const [decoded] = IDL.decode([viewType], bytes);
      const logbook = convertLogbook(decoded as unknown as RawLogbookView);

      expect(logbook.uprn).toBe('100081152294');
      expect(logbook.owner).toBe(Principal.anonymous().toText());
      expect(logbook.entries).toHaveLength(4);
      expect(logbook.entries[0].evidence).toBe('systemDerived');
      expect(logbook.entries[0].recordedByTransaction).toBe('tx-1');
      expect(logbook.entries[2].recordedByTransaction).toBeNull();
      expect(describeEntry(logbook.entries[0])).toBe(
        'Property recorded — 12 Ivel Road, SG19 1AB (Detached house)',
      );
      expect(describeEntry(logbook.entries[1])).toBe('Sold for £400,000 · 14 Aug 2026');
      expect(describeEntry(logbook.entries[2])).toBe('TA6 anchored · SHA-256 …ab12');
      expect(describeEntry(logbook.entries[3])).toBe('Searches ordered — OneSearch LLC1, CON29');
    });
  });

  describe('getMyLogbooks', () => {
    it('should build the actor on the authenticated agent and return parsed logbooks', async () => {
      vi.stubEnv('VITE_LOGBOOK_CANISTER_ID', 'aaaaa-aa');
      const authAgent = { kind: 'authenticated-agent' };
      getAuthenticatedAgent.mockResolvedValue(authAgent);
      getMyLogbooksQuery.mockResolvedValue([rawFixture({ toText: () => 'owner-principal' })]);

      const result = await getMyLogbooks();

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') throw new Error('unreachable');
      expect(result.logbooks).toHaveLength(1);
      expect(result.logbooks[0].owner).toBe('owner-principal');
      expect(result.logbooks[0].entries).toHaveLength(4);
      // The caller-scoped query must ride the authenticated agent, not a
      // fresh anonymous one.
      expect(createActor).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ agent: authAgent, canisterId: 'aaaaa-aa' }),
      );
    });

    it('should report unavailable without touching the actor when the canister id is unset', async () => {
      vi.stubEnv('VITE_LOGBOOK_CANISTER_ID', '');
      const result = await getMyLogbooks();
      expect(result).toEqual({ status: 'unavailable' });
      expect(createActor).not.toHaveBeenCalled();
      expect(getAuthenticatedAgent).not.toHaveBeenCalled();
    });

    it('should degrade to unavailable (not throw) when the query fails', async () => {
      vi.stubEnv('VITE_LOGBOOK_CANISTER_ID', 'aaaaa-aa');
      getAuthenticatedAgent.mockResolvedValue({});
      getMyLogbooksQuery.mockRejectedValue(new Error('canister rejected'));
      const result = await getMyLogbooks();
      expect(result).toEqual({ status: 'unavailable' });
    });
  });
});
