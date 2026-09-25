import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-1' } } })) } },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../config/features', () => ({ FEATURE_FLAGS: { AML_ENABLED: true } }));

import { amlService, amlProductRef } from './aml.service';
import type { AmlPersonalDetails } from './aml.service';

const fetchMock = vi.fn();

const PERSONAL_DETAILS: AmlPersonalDetails = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+447700900000',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('amlService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AML_WORKER_URL', 'https://aml.test');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('getPricing', () => {
    it('should return only standard and enhanced tiers with a positive server price', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ tiers: [{ tier: 'lite', retailPence: 111 }, { tier: 'standard', retailPence: 1234 }, { tier: 'enhanced', retailPence: 5678 }] }),
      );
      const { tiers } = await amlService.getPricing();
      expect(tiers.map((t) => t.tier)).toEqual(['standard', 'enhanced']);
      expect(fetchMock.mock.calls[0][0]).toBe('https://aml.test/pricing');
    });

    it('should pass the provider the worker declares through to the panel', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ provider: { id: 'verify365', name: 'Verify 365' }, tiers: [{ tier: 'standard', retailPence: 1234 }] }),
      );
      const { provider } = await amlService.getPricing();
      expect(provider).toEqual({ id: 'verify365', name: 'Verify 365' });
    });

    it('should report no provider, rather than inventing one, when the worker omits or mangles it', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ tiers: [{ tier: 'standard', retailPence: 1234 }] }));
      expect((await amlService.getPricing()).provider).toBeNull();
      fetchMock.mockResolvedValueOnce(jsonResponse({ provider: { id: 'verify365', name: '   ' }, tiers: [{ tier: 'standard', retailPence: 1234 }] }));
      expect((await amlService.getPricing()).provider).toBeNull();
    });

    it('should throw rather than invent a price when the worker returns no tiers', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ tiers: [] }));
      await expect(amlService.getPricing()).rejects.toThrow('AML pricing is not configured');
    });

    it('should throw when the worker URL is missing', async () => {
      vi.stubEnv('VITE_AML_WORKER_URL', '');
      await expect(amlService.getPricing()).rejects.toThrow('not available');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('listChecks', () => {
    it('should send the JWT and return the checks for a deal', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ checks: [{ id: 'c1', subjectPrincipal: 'p1', status: 'in_progress' }] }));
      const checks = await amlService.listChecks('TX 1');
      expect(checks).toHaveLength(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://aml.test/checks?transactionId=TX%201');
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt-1' });
    });

    it('should return an empty list when the worker omits checks', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      await expect(amlService.listChecks('TX-1')).resolves.toEqual([]);
    });
  });

  describe('createOrder', () => {
    it('should post subject principal, tier and personal details — never a price', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 'o1', retailPence: 1234 }));
      const order = await amlService.createOrder({
        transactionId: 'TX-1',
        subjectPrincipal: 'p1',
        tier: 'standard',
        personalDetails: PERSONAL_DETAILS,
      });
      expect(order).toEqual({ id: 'o1', retailPence: 1234 });
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ transactionId: 'TX-1', subjectPrincipal: 'p1', tier: 'standard', personalDetails: PERSONAL_DETAILS });
    });

    it('should send personal details with the order', async () => {
      const orderFetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'chk-1', retailPence: 1980 }), { status: 200 }),
      );
      vi.stubGlobal('fetch', orderFetchMock);

      await amlService.createOrder({
        transactionId: 'tx-1',
        subjectPrincipal: 'princ-me',
        tier: 'standard',
        personalDetails: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+447700900000' },
      });

      const body = JSON.parse(orderFetchMock.mock.calls[0][1].body as string);
      expect(body.personalDetails).toEqual({
        firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+447700900000',
      });
    });

    it('should never send a price with the order', async () => {
      const orderFetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'chk-1', retailPence: 1980 }), { status: 200 }),
      );
      vi.stubGlobal('fetch', orderFetchMock);

      await amlService.createOrder({
        transactionId: 'tx-1', subjectPrincipal: 'princ-me', tier: 'standard',
        personalDetails: { firstName: 'A', lastName: 'B', email: 'a@b.c', phone: '+44' },
      });

      const body = JSON.parse(orderFetchMock.mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty('retailPence');
      expect(body).not.toHaveProperty('retailGbp');
    });

    it('should surface the worker message when the order is refused', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'A check is already in progress for this person' }, 409));
      await expect(
        amlService.createOrder({ transactionId: 'TX-1', subjectPrincipal: 'p1', tier: 'standard', personalDetails: PERSONAL_DETAILS }),
      ).rejects.toThrow('already in progress');
    });

    it('should reject an order response without an id', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ retailPence: 1234 }));
      await expect(
        amlService.createOrder({ transactionId: 'TX-1', subjectPrincipal: 'p1', tier: 'standard', personalDetails: PERSONAL_DETAILS }),
      ).rejects.toThrow('incomplete order');
    });
  });

  it('should build the aml productRef payment-worker expects', () => {
    expect(amlProductRef('o1')).toBe('aml:o1');
  });
});
