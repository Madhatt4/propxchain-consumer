import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeListing, isValidListingUrl, detectPortal } from '../listing.service';

const mockSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => mockSession() } },
}));

describe('isValidListingUrl', () => {
  it('accepts a Rightmove property URL', () => {
    expect(isValidListingUrl('https://www.rightmove.co.uk/properties/164289332')).toBe(true);
    expect(isValidListingUrl('https://www.rightmove.co.uk/property-for-sale/property-123.html')).toBe(true);
  });
  it('accepts a Purplebricks property URL', () => {
    expect(isValidListingUrl('https://www.purplebricks.co.uk/property-for-sale/5-bedroom-detached-house-biggleswade-2026219')).toBe(true);
  });
  it('rejects Purplebricks URL without trailing id', () => {
    expect(isValidListingUrl('https://www.purplebricks.co.uk/property-for-sale/no-id')).toBe(false);
  });
  it('accepts an OnTheMarket details URL', () => {
    expect(isValidListingUrl('https://www.onthemarket.com/details/19047665/')).toBe(true);
    expect(isValidListingUrl('https://www.onthemarket.com/details/19047665')).toBe(true);
  });
  it('rejects OnTheMarket non-details path', () => {
    expect(isValidListingUrl('https://www.onthemarket.com/for-sale/property/sg19/')).toBe(false);
  });
  it('rejects unsupported portals', () => {
    expect(isValidListingUrl('https://www.zoopla.co.uk/for-sale/details/72987175/')).toBe(false);
    expect(isValidListingUrl('https://villageagent.co.uk/listing/1')).toBe(false);
  });
  it('rejects Rightmove URLs that are not property pages', () => {
    expect(isValidListingUrl('https://www.rightmove.co.uk/')).toBe(false);
  });
  it('rejects non-http schemes', () => {
    expect(isValidListingUrl('javascript:alert(1)')).toBe(false);
  });
  it('rejects garbage', () => {
    expect(isValidListingUrl('not a url')).toBe(false);
  });
});

describe('detectPortal', () => {
  const LISTING_URLS = [
    ['rightmove', 'https://www.rightmove.co.uk/properties/164289332'],
    ['purplebricks', 'https://www.purplebricks.co.uk/property-for-sale/5-bedroom-detached-house-biggleswade-2026219'],
    ['onthemarket', 'https://www.onthemarket.com/details/19047665/'],
  ] as const;

  it.each(LISTING_URLS)('should identify %s', (portal, url) => {
    expect(detectPortal(url)).toBe(portal);
  });

  // The gap this replaced: detectPortal kept its own host list and OnTheMarket
  // was only ever added to isValidListingUrl, so a URL the app happily scraped
  // reported no portal at all. One table now feeds both, and this asserts the
  // invariant rather than the individual hosts — a fourth portal added to only
  // one of them fails here.
  it('should never accept a listing URL it cannot attribute to a portal', () => {
    for (const [, url] of LISTING_URLS) {
      expect(isValidListingUrl(url)).toBe(true);
      expect(detectPortal(url)).not.toBeNull();
    }
  });

  it('should identify the portal for a non-listing path on a supported host', () => {
    // Deliberate: detectPortal answers "whose site is this", not "can we scrape
    // it". isValidListingUrl is the scrapeability question and rejects these.
    expect(detectPortal('https://www.rightmove.co.uk/')).toBe('rightmove');
    expect(isValidListingUrl('https://www.rightmove.co.uk/')).toBe(false);
    expect(detectPortal('https://www.onthemarket.com/for-sale/property/sg19/')).toBe('onthemarket');
  });

  it('should return null for unsupported portals and garbage', () => {
    expect(detectPortal('https://www.zoopla.co.uk/for-sale/details/72987175/')).toBeNull();
    expect(detectPortal('not a url')).toBeNull();
    expect(detectPortal('')).toBeNull();
  });

  it('should return null for a non-http scheme on a supported host', () => {
    expect(detectPortal('javascript:alert(1)')).toBeNull();
    expect(detectPortal('ftp://www.rightmove.co.uk/properties/1')).toBeNull();
  });

  // A bare hostname.endsWith('rightmove.co.uk') also matches a lookalike whose
  // name merely ends with it, and notrightmove.co.uk is registerable. This
  // value decides what the scraper worker fetches server-side, so a suffix
  // match would hand an attacker the URL the worker retrieves.
  describe('lookalike hosts', () => {
    const LOOKALIKES = [
      'https://notrightmove.co.uk/properties/164289332',
      'https://fake-rightmove.co.uk/properties/164289332',
      'https://evilonthemarket.com/details/19047665/',
      'https://xpurplebricks.co.uk/property-for-sale/a-house-123',
    ];

    it.each(LOOKALIKES)('should not attribute %s to a portal', (url) => {
      expect(detectPortal(url)).toBeNull();
      expect(isValidListingUrl(url)).toBe(false);
    });

    it('should still accept genuine subdomains of a portal', () => {
      expect(detectPortal('https://www.rightmove.co.uk/properties/1')).toBe('rightmove');
      expect(detectPortal('https://rightmove.co.uk/properties/1')).toBe('rightmove');
      expect(isValidListingUrl('https://media.rightmove.co.uk/properties/1')).toBe(true);
    });
  });
});

describe('scrapeListing', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    mockSession.mockResolvedValue({ data: { session: { access_token: 'tkn' } } });
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      listing: { url: 'https://www.rightmove.co.uk/properties/123', address: '1 High St', price: 425000, source: 'llm' },
      provenance: { address: 'llm', price: 'llm' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
  });
  afterEach(() => { global.fetch = originalFetch; });

  it('sends Bearer token and URL payload', async () => {
    await scrapeListing('https://www.rightmove.co.uk/properties/123');
    expect(global.fetch).toHaveBeenCalled();
    const call = (global.fetch as any).mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(call[1].headers.authorization).toBe('Bearer tkn');
    expect(JSON.parse(call[1].body).url).toBe('https://www.rightmove.co.uk/properties/123');
  });

  it('returns listing + provenance on 200', async () => {
    const r = await scrapeListing('https://www.rightmove.co.uk/properties/123');
    expect(r.listing.price).toBe(425000);
    expect(r.provenance.price).toBe('llm');
  });

  it('throws on error response with body.error', async () => {
    (global.fetch as any).mockResolvedValueOnce(new Response(
      JSON.stringify({ error: 'You\'ve hit the import limit. Try again in an hour.' }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    ));
    await expect(scrapeListing('https://www.rightmove.co.uk/properties/123')).rejects.toThrow(/import limit/);
  });

  it('throws sign-in prompt on 401', async () => {
    mockSession.mockResolvedValue({ data: { session: null } });
    await expect(scrapeListing('https://www.rightmove.co.uk/properties/123')).rejects.toThrow(/sign in/i);
  });

  // Regression 2026-08-31: the worker drops a field whose every tier came back
  // empty, so a listing with no photos/features arrived with the keys absent
  // rather than as []. PropertyListing declares both as always-present arrays
  // and the preview card reads `.length`, so the import threw mid-render and
  // the global ErrorBoundary replaced the page with "Something went wrong".
  describe('array-field normalisation at the worker boundary', () => {
    const respondWith = (listing: Record<string, unknown>): void => {
      (global.fetch as any).mockResolvedValueOnce(new Response(
        JSON.stringify({ listing, provenance: { address: 'llm' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));
    };

    it('should default absent images and keyFeatures to empty arrays', async () => {
      respondWith({ url: 'https://www.rightmove.co.uk/properties/123', address: '1 High St', price: 425000 });

      const r = await scrapeListing('https://www.rightmove.co.uk/properties/123');

      expect(r.listing.images).toEqual([]);
      expect(r.listing.keyFeatures).toEqual([]);
    });

    it('should preserve images and keyFeatures the worker did supply', async () => {
      respondWith({
        url: 'https://www.rightmove.co.uk/properties/123',
        address: '1 High St',
        price: 425000,
        images: [{ url: 'https://x/a.jpg', caption: 'front' }],
        keyFeatures: ['Garage'],
      });

      const r = await scrapeListing('https://www.rightmove.co.uk/properties/123');

      expect(r.listing.images).toHaveLength(1);
      expect(r.listing.keyFeatures).toEqual(['Garage']);
    });

    it('should coerce a non-array value rather than passing it through', async () => {
      respondWith({ url: 'https://www.rightmove.co.uk/properties/123', address: '1 High St', images: null });

      const r = await scrapeListing('https://www.rightmove.co.uk/properties/123');

      expect(r.listing.images).toEqual([]);
    });

    it('should throw a usable message when the worker returns 200 with no listing', async () => {
      (global.fetch as any).mockResolvedValueOnce(new Response(
        JSON.stringify({ provenance: {} }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));

      await expect(scrapeListing('https://www.rightmove.co.uk/properties/123')).rejects.toThrow(/Paste details manually/);
    });
  });
});
