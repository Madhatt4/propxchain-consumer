import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The service reads import.meta.env and Supabase at module load; neither is
// needed for the pure guards under test.
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: {} }) } } }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import {
  isQuoteOrderable,
  tmGroupAddressFromParts,
  tmgroupService,
  type TmGroupQuote,
} from '@/services/tmgroup.service';

/** A quote that should be orderable, so each case below changes exactly one thing. */
function goodQuote(over: Partial<TmGroupQuote> = {}): TmGroupQuote {
  return {
    success: true,
    isComplete: true,
    grossPence: 27000,
    failedProductTypes: [],
    unpricedProductTypes: [],
    ...over,
  };
}

describe('isQuoteOrderable', () => {
  it('should allow a complete, fully priced quote', () => {
    expect(isQuoteOrderable(goodQuote())).toBe(true);
  });

  it('should REFUSE a £0 quote — that is a free order, not a cheap one', () => {
    // The whole reason this guard exists. tmGroup answer 200 with every line at
    // £0.00 and an EMPTY failure list when they cannot resolve a property's
    // authorities (demo20, 2026-08-10). Charging £0 then places a real order
    // against searches that cost us £100-£300.
    expect(isQuoteOrderable(goodQuote({ grossPence: 0 }))).toBe(false);
  });

  it('should refuse when tmGroup flagged unpriced products even if a total exists', () => {
    expect(isQuoteOrderable(goodQuote({ unpricedProductTypes: ['LLC1'] }))).toBe(false);
  });

  it('should refuse when any product failed', () => {
    expect(isQuoteOrderable(goodQuote({ failedProductTypes: ['TMGCon29'] }))).toBe(false);
  });

  it('should refuse an incomplete quote', () => {
    expect(isQuoteOrderable(goodQuote({ isComplete: false }))).toBe(false);
  });

  it('should refuse a failed request outright', () => {
    expect(isQuoteOrderable({ success: false, error: 'unsupported_jurisdiction' })).toBe(false);
  });

  it('should refuse when the total is missing rather than treating it as free', () => {
    expect(isQuoteOrderable(goodQuote({ grossPence: undefined }))).toBe(false);
  });
});

describe('tmGroupAddressFromParts', () => {
  it('should carry a lower-case postcode, which is what tmGroup read first', () => {
    const addr = tmGroupAddressFromParts(
      { addressLine1: '12 High Street', town: 'Biggleswade', postcode: 'SG18 0JT' },
      '',
      'SG18 0JT',
    );
    expect(addr.postcode).toBe('SG18 0JT');
  });

  it('should fall back to the free-text address when the listing has no structured parts', () => {
    // A transaction created before the seller completed Property Details has only
    // whatever was typed at creation. Ordering must still identify the property.
    const addr = tmGroupAddressFromParts(null, '12 High Street, Biggleswade', 'SG18 0JT');
    expect(addr.postcode).toBe('SG18 0JT');
  });

  it('should still produce a postcode when the structured parts omit one', () => {
    const addr = tmGroupAddressFromParts({ addressLine1: '12 High Street' }, '', 'SG18 0JT');
    expect(addr.postcode).toBe('SG18 0JT');
  });
});

// ─── Network methods ────────────────────────────────────────────────────────
// Flagged by the Standards review as untested on a money path. This is the layer
// that decides whether a request reaches tmGroup at all, and how a refusal gets
// reported — exactly where the deleted 2026-08-09 bug lived.

const ADDRESS = { postcode: 'SG18 0JT' };

describe('getQuote / placeOrder', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // The service reads the worker URL lazily, so stubbing it here is enough;
    // without it isEnabled() is false and every call short-circuits to disabled.
    vi.stubEnv('VITE_TMGROUP_WORKER_URL', 'https://worker.test');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function respond(ok: boolean, body: unknown): void {
    fetchMock.mockResolvedValue({ ok, json: async () => body });
  }

  it('should refuse an empty basket without calling the worker', () => {
    // Asking anyway would create a real tmGroup project to price nothing.
    return tmgroupService.getQuote({ productCodes: [], address: ADDRESS }).then((result) => {
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_products_selected');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('should refuse a missing postcode without calling the worker', async () => {
    const result = await tmgroupService.getQuote({
      productCodes: ['PSReport12'],
      address: { postcode: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('missing_postcode');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should surface the human-readable refusal, not just the code', async () => {
    // The jurisdiction refusal carries a message meant for a person. Dropping it
    // leaves the picker with a code it cannot show anybody.
    respond(false, {
      error: 'unsupported_jurisdiction',
      message: 'PropXchain currently covers England and Wales only.',
    });

    const result = await tmgroupService.getQuote({ productCodes: ['PSReport12'], address: ADDRESS });

    expect(result.success).toBe(false);
    expect(result.error).toBe('unsupported_jurisdiction');
    expect(result.message).toMatch(/England and Wales/);
  });

  it('should pass a successful quote through intact', async () => {
    respond(true, {
      grossPence: 27000,
      isComplete: true,
      unpricedProductTypes: [],
      failedProductTypes: [],
    });

    const result = await tmgroupService.getQuote({ productCodes: ['PSReport12'], address: ADDRESS });

    expect(result.success).toBe(true);
    expect(result.grossPence).toBe(27000);
    expect(isQuoteOrderable(result)).toBe(true);
  });

  it('should return a failure rather than throw when the network dies', async () => {
    // A throw would escape into the click handler and leave the button stuck.
    fetchMock.mockRejectedValue(new Error('offline'));

    const result = await tmgroupService.getQuote({ productCodes: ['PSReport12'], address: ADDRESS });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should NEVER send a price when placing an order', async () => {
    // The 2026-08-09 bug in one assertion: the client supplied the total and it
    // was charged. payment-worker re-derives from the row, and nothing sent from
    // here may influence the amount.
    respond(true, { id: 'row-1', ourReference: 'ref', retailPence: 27000, status: 'pending_payment' });

    await tmgroupService.placeOrder({ productCodes: ['PSReport12'], address: ADDRESS });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('retailPence');
    expect(body).not.toHaveProperty('totalPence');
    expect(body).not.toHaveProperty('price');
    expect(body.productCodes).toEqual(['PSReport12']);
  });

  it('should carry unpricedProductTypes off a 422 so the caller can explain why', async () => {
    respond(false, {
      error: 'incomplete_quote',
      unpricedProductTypes: ['PSReport12'],
      failedProductTypes: [],
    });

    const result = await tmgroupService.placeOrder({ productCodes: ['PSReport12'], address: ADDRESS });

    expect(result.success).toBe(false);
    expect(result.unpricedProductTypes).toEqual(['PSReport12']);
  });
});
