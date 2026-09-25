import { describe, it, expect } from 'vitest';

import {
  tmGroupProvider,
  onesearchProvider,
  onesearchPacks,
  grossPence,
  onesearchFullCatalogue,
  onesearchCatalogueByCode,
  getResidentialOneSearchCatalogue,
  groundsureBundles,
  groundsureSingles,
  groundsureRegionals,
  groundsureCatalogue,
  groundsureProductCodes,
  groundsureCodeFor,
} from '@/services/searchProviderData';
import type {
  SearchItem,
  SearchProvider,
  OneSearchPack,
  OneSearchCatalogueItem,
} from '@/services/searchProviderData';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Every SearchItem that appears anywhere in the module, for invariant sweeps. */
const LIVE_PROVIDERS = [onesearchProvider, tmGroupProvider];

const allSearchItems: SearchItem[] = [
  ...LIVE_PROVIDERS.flatMap((p) => [
    ...p.standardPackSearches,
    ...p.additionalSearches,
  ]),
  ...onesearchPacks.flatMap((pack) => pack.items),
  ...groundsureBundles,
  ...groundsureSingles,
  ...groundsureRegionals,
];

// ─────────────────────────────────────────────────────────────────────────────
// Cross-cutting price/currency integrity — the revenue-critical invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('searchProviderData price integrity (pence)', () => {
  it('should express every item price as a finite, non-negative integer number of pence', () => {
    // Arrange / Act done at module load; Assert the invariant on every item.
    for (const item of allSearchItems) {
      expect(Number.isFinite(item.pricePence), `${item.id} price finite`).toBe(true);
      expect(Number.isNaN(item.pricePence), `${item.id} price not NaN`).toBe(false);
      expect(Number.isInteger(item.pricePence), `${item.id} price integer`).toBe(true);
      expect(item.pricePence, `${item.id} price >= 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it('should express every provider standardPackPence as an integer, positive unless priced per property', () => {
    // tmGroup quote per property (LA £100-£300 by council, water £17-£98), so a
    // headline pack price would be fiction and the catalogue carries 0. Every
    // provider with a FIXED pack must still have a positive one — a 0 there
    // would be a real free-order bug, which is what this test exists to catch.
    const pricedPerProperty = new Set(['tmgroup']);
    for (const provider of LIVE_PROVIDERS) {
      expect(Number.isInteger(provider.standardPackPence)).toBe(true);
      if (pricedPerProperty.has(provider.id)) {
        expect(provider.standardPackPence).toBe(0);
      } else {
        expect(provider.standardPackPence, `${provider.id} must have a pack price`).toBeGreaterThan(0);
      }
    }
  });

  it('should express every OneSearch pack rrpPence as a positive integer number of pence', () => {
    for (const pack of onesearchPacks) {
      expect(Number.isInteger(pack.rrpPence)).toBe(true);
      expect(pack.rrpPence).toBeGreaterThan(0);
      expect(Number.isInteger(pack.netPence)).toBe(true);
      expect(pack.netPence).toBeGreaterThan(0);
    }
  });

  it('should give every SearchItem a non-empty id and human name', () => {
    for (const item of allSearchItems) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tmGroup provider — tier-1 panel provider with the fullest add-on catalogue
// ─────────────────────────────────────────────────────────────────────────────

describe('tmGroupProvider', () => {
  // Rewritten 2026-08-09. This block used to assert £120 / £45 / £55 for the
  // included searches, a £250 pack and a £50 priority fee. Not one of those
  // figures came from tmGroup — they were invented, and the tests then locked
  // them in, which is how they survived long enough to reach a charge.
  //
  // The catalogue is now the real one, read from tmGroup's live AvailableProducts
  // API. These tests guard the opposite invariant: that no price is asserted at
  // all, because tmGroup quote per property and we cannot know one yet.

  it('should be a tier-1 provider that does NOT claim instant ordering', () => {
    expect(tmGroupProvider.id).toBe('tmgroup');
    expect(tmGroupProvider.tier).toBe(1);
    // Ordering is not wired: the worker exists but tmGroup's sandbox 500s on
    // every write. Claiming instantOrder would promise something we cannot do.
    expect(tmGroupProvider.instantOrder).toBe(false);
  });

  it('should carry NO price on any item, because tmGroup quote per property', () => {
    // Local Authority fees run £100-£300 by council and water £17-£98 (tmGroup,
    // 2026-07-23). A fixed number here can only ever be fiction, and a
    // non-zero one could be summed into a total and charged.
    const all = [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches];
    for (const item of all) {
      expect(item.pricePence).toBe(0);
    }
    expect(tmGroupProvider.standardPackPence).toBe(0);
  });

  it('should not advertise a priority fee it cannot honour', () => {
    expect(tmGroupProvider.priorityFeePence).toBeUndefined();
  });

  it('should use tmGroup product codes that exist in their live catalogue', () => {
    // Read from AvailableProducts (demo20, Residential/Purchase) on 2026-08-09.
    // A code that is not in tmGroup's catalogue cannot be ordered, and their own
    // docs warn that passing an incorrect productType "may result in unexpected
    // charges, or failure to place an order".
    //
    // GSAvistaR (line 214) and FTResCR (line 208) added 2026-08-28, after Halif
    // Saddiquin sent a screenshot of that same 2026-08-09 response showing both
    // present.
    //
    // NOTE WHAT THIS SET IS: codes transcribed from the response, not the
    // response. It is a subset of 98, and mistaking it for the whole catalogue is
    // exactly what led to telling tmGroup they did not sell products they do. A
    // code missing here means "not transcribed", never "not available".
    // CDSRegWDR added 2026-09-01 after a re-pull returned 100 products (was 98);
    // tmGroup activated the pack codes on DEMO20 that day.
    const live = new Set([
      'PSReport12', 'Con29DW', 'EnviroschR', 'TMGLLC1', 'TMGCon29',
      'GSEnviro', 'GSAvistaR', 'FTResCR', 'CDSRegWDR',
      'Con29M', 'CornTin', 'CCheck', 'FloodR', 'CDSHWayEnR',
    ]);
    const all = [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches];
    for (const item of all) {
      expect(item.productType).toBeDefined();
      expect(live.has(item.productType as string)).toBe(true);
    }
  });

  it('should give every item a unique id', () => {
    const ids = [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches]
      .map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('tmg-'))).toBe(true);
  });

  it('should categorise mining searches as area-specific and the rest as optional', () => {
    const byId = new Map(tmGroupProvider.additionalSearches.map((s) => [s.id, s]));
    expect(byId.get('tmg-con29m')?.category).toBe('area-specific');
    expect(byId.get('tmg-corntin')?.category).toBe('area-specific');
    expect(byId.get('tmg-ccheck')?.category).toBe('optional');
    expect(byId.get('tmg-floodr')?.category).toBe('optional');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OneSearch provider metadata + PISCES product codes (must match the worker)
// ─────────────────────────────────────────────────────────────────────────────

describe('onesearchProvider (PISCES metadata)', () => {
  it('should be a tier-1 instant-order provider flagged Recommended', () => {
    expect(onesearchProvider.id).toBe('onesearch');
    expect(onesearchProvider.tier).toBe(1);
    expect(onesearchProvider.instantOrder).toBe(true);
    expect(onesearchProvider.highlight).toBe('Recommended');
  });

  it('should carry a £259.20 "from" price equal to the Standard pack VAT-inclusive RRP', () => {
    // Inc-VAT, because payment-worker charges the VAT-inclusive retail_gbp the
    // worker stamps on the order row. A net header would quote a price 20% below
    // what checkout actually takes.
    expect(onesearchProvider.standardPackPence).toBe(25920);
    expect(onesearchPacks.find((p) => p.id === 'standard')?.rrpPence).toBe(25920);
  });

  it('should emit the three confirmed PISCES codes for its standard searches', () => {
    const codeById = new Map(
      onesearchProvider.standardPackSearches.map((s) => [s.id, s.productType]),
    );
    expect(codeById.get('onesearch-llc1con29')).toBe('LLC1CON29');
    expect(codeById.get('onesearch-dw')).toBe('ONESEARCHDW');
    expect(codeById.get('onesearch-envres')).toBe('ENVRES');
  });

  it('should emit the two confirmed PISCES codes for its additional searches', () => {
    const codeById = new Map(
      onesearchProvider.additionalSearches.map((s) => [s.id, s.productType]),
    );
    expect(codeById.get('onesearch-homecheckpro')).toBe('HOMECHECKPRO');
    expect(codeById.get('onesearch-coal-con29m')).toBe('LANDMARKCON29M');
  });

  it('should carry the exact per-search PISCES prices ordered via the worker', () => {
    const priceByCode = new Map(
      [
        ...onesearchProvider.standardPackSearches,
        ...onesearchProvider.additionalSearches,
      ].map((s) => [s.productType, s.pricePence]),
    );
    expect(priceByCode.get('LLC1CON29')).toBe(10752);
    expect(priceByCode.get('ONESEARCHDW')).toBe(5586);
    expect(priceByCode.get('ENVRES')).toBe(10680);
    expect(priceByCode.get('HOMECHECKPRO')).toBe(7440);
    expect(priceByCode.get('LANDMARKCON29M')).toBe(5700);
  });

  it('should give every OneSearch search item a defined productType (unlike other providers)', () => {
    const oneSearchItems = [
      ...onesearchProvider.standardPackSearches,
      ...onesearchProvider.additionalSearches,
    ];
    expect(oneSearchItems.every((s) => typeof s.productType === 'string')).toBe(true);
  });

  it('should keep tmGroup codes out of the PISCES catalogue and vice versa', () => {
    // A tmGroup code reaching onesearch-worker would not match any pack signature
    // and would 400; a PISCES code sent to tmGroup could, per their own docs,
    // "result in unexpected charges".
    const tmCodes = new Set(
      [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches]
        .map((s) => s.productType),
    );
    const piscesCodes = new Set(
      [...onesearchProvider.standardPackSearches, ...onesearchProvider.additionalSearches]
        .map((s) => s.productType),
    );
    for (const code of tmCodes) {
      expect(piscesCodes.has(code), `${code} must not be in both catalogues`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OneSearch consumer packs — the 3-tier "pick a pack" revenue model
// ─────────────────────────────────────────────────────────────────────────────

describe('onesearchPacks (pick-a-pack model)', () => {
  it('should expose the three tiers, cheapest first', () => {
    expect(onesearchPacks.map((p) => p.id)).toEqual([
      'standard',
      'standard-refresh',
      'premium',
    ]);
  });

  it('should no longer sell Drainage & Water as a standalone pack', () => {
    // Removed 2026-08-01: it carried a placeholder trade price, so our
    // margin was unknown at the point of sale. DW is still requestable via the
    // full catalogue, which asks OneSearch for a real price.
    expect(onesearchPacks.some((p) => p.items.length === 1)).toBe(false);
  });

  it('should still include Drainage & Water inside every pack', () => {
    for (const pack of onesearchPacks) {
      expect(pack.items.map((i) => i.productType)).toContain('ONESEARCHDW');
    }
  });

  it('should price the tiers at the VAT-inclusive RRPs (£259.20 / £336 / £372)', () => {
    const rrpById = new Map(onesearchPacks.map((p) => [p.id, p.rrpPence]));
    expect(rrpById.get('standard')).toBe(25920);
    expect(rrpById.get('standard-refresh')).toBe(33600);
    expect(rrpById.get('premium')).toBe(37200);
  });

  it('should carry the net prices onesearch-worker re-prices against (£216 / £280 / £310)', () => {
    // The worker rejects any order whose net disagrees with its own table, so
    // these must move with ONESEARCH_PACK_PRICES_GBP in the same change.
    const netById = new Map(onesearchPacks.map((p) => [p.id, p.netPence]));
    expect(netById.get('standard')).toBe(21600);
    expect(netById.get('standard-refresh')).toBe(28000);
    expect(netById.get('premium')).toBe(31000);
  });

  it('should keep every RRP exactly its net plus VAT', () => {
    for (const pack of onesearchPacks) {
      expect(pack.rrpPence).toBe(grossPence(pack.netPence));
    }
  });

  it('should undercut the nearest consumer-direct competitor on every tier', () => {
    // Property Searches Direct (propertysearchesdirect.co.uk), re-read 2026-08-27:
    // comparable Residential Purchase Search Pack £345, top AVISTA pack £378.
    //
    // The upper tiers are capped to keep this true, so fix the price rather
    // than relaxing this test. £5 of headroom absorbs a small move.
    const PSD_COMPARABLE_PENCE = 34500;
    const PSD_DEAREST_RESIDENTIAL_PENCE = 37800;
    const HEADROOM_PENCE = 500;
    const ceilingById: Record<string, number> = {
      standard: PSD_COMPARABLE_PENCE,
      'standard-refresh': PSD_COMPARABLE_PENCE,
      premium: PSD_DEAREST_RESIDENTIAL_PENCE,
    };
    for (const pack of onesearchPacks) {
      expect(pack.rrpPence).toBeLessThanOrEqual(ceilingById[pack.id] - HEADROOM_PENCE);
    }
  });

  it('should never charge less than £60 net for the refresh, which costs £40', () => {
    // The refresh is NOT discounted with the rest. At the old £290 the retail
    // step over Standard was £40 against a £40 cost, so it earned nothing, and
    // the 2026-08-08 cut would have taken that step to £36 — selling it at a
    // £4 loss on every pack. Marc's rule: cost £40 + £20 margin — a FLOOR, not a
    // fixed step. The 2026-08-27 cap sets it at £64, above that floor and below
    // the £72 a straight 1.8 would have produced.
    const netById = new Map(onesearchPacks.map((p) => [p.id, p.netPence]));
    const standard = netById.get('standard') ?? 0;
    const step = (netById.get('standard-refresh') ?? 0) - standard;
    expect(step).toBeGreaterThanOrEqual(6000);
    expect(step).toBe(6400);
  });


  it('should order the tiers by ascending RRP so the ladder reads cheap to premium', () => {
    const rrps = onesearchPacks.map((p) => p.rrpPence);
    const ascending = [...rrps].sort((a, b) => a - b);
    expect(rrps).toEqual(ascending);
  });

  it('should badge only the Standard pack as "Most popular"', () => {
    const standard = onesearchPacks.find((p) => p.id === 'standard');
    expect(standard?.badge).toBe('Most popular');
    const others = onesearchPacks.filter((p) => p.id !== 'standard');
    expect(others.every((p) => p.badge === undefined)).toBe(true);
  });

  it('should build the Standard pack from LA + Water + Homecheck with all codes confirmed', () => {
    const standard = onesearchPacks.find((p) => p.id === 'standard');
    expect(standard?.items.map((i) => i.id)).toEqual([
      'onesearch-llc1con29',
      'onesearch-dw',
      'onesearch-homecheck-res',
    ]);
    expect(standard?.items.map((i) => i.productType)).toEqual([
      'LLC1CON29',
      'ONESEARCHDW',
      'HOMECHECKPRO',
    ]);
  });

  it('should NOT flag the Standard pack as orderCodesPending because every code is confirmed', () => {
    const standard = onesearchPacks.find((p) => p.id === 'standard');
    expect(standard?.orderCodesPending).toBeUndefined();
    expect(standard?.items.every((i) => typeof i.productType === 'string')).toBe(true);
  });

  it('should carry the confirmed REFRESH product code on the refresh item', () => {
    // OneSearch, 2026-07-27: "just add product code REFRESH to your order."
    // Absent from their product list because it is a FEE item,
    // not a search product — which is why an earlier pass found no code.
    const refresh = onesearchPacks
      .flatMap((p) => p.items)
      .find((i) => i.id === 'onesearch-refresh');
    expect(refresh?.productType).toBe('REFRESH');
  });

  it('should have a PISCES code on EVERY pack item now', () => {
    const missing = onesearchPacks
      .flatMap((p) => p.items)
      .filter((i) => !i.productType)
      .map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('should offer the refresh packs for sale — all three gates have cleared', () => {
    // Held back in turn by the CODE (REFRESH, confirmed 2026-07-27), the FEE
    // (agreed 2026-08-03), and the COPY being honest that the refresh is a
    // manual claim we make rather than something automatic (#174). The gates
    // and their rationale live on PACK_ITEM_REFRESH in searchProviderData.ts;
    // this test only asserts the resulting state.
    for (const id of ['standard-refresh', 'premium']) {
      const pack = onesearchPacks.find((p) => p.id === id);
      expect(pack?.orderCodesPending).toBeUndefined();
    }
  });

  it('should tell the customer WE arrange the refresh, never imply it is automatic', () => {
    // OneSearch, 2026-07-27: "to actually claim on the refresh, you'll need to
    // contact CS just now." PropXchain is merchant of record, so we make that
    // call, not the customer. The old copy ("Adds a 6-month refresh, so your
    // searches stay valid for 12 months") stated the outcome without the
    // mechanism, which read as automatic. This guards the fix: every refresh
    // pack must say who does the work.
    const refreshPacks = onesearchPacks.filter((p) =>
      p.items.some((i) => i.productType === 'REFRESH'),
    );
    expect(refreshPacks.length).toBeGreaterThan(0);
    for (const pack of refreshPacks) {
      expect(pack.note).toBeTruthy();
      expect(pack.note).toMatch(/\bwe\b/i);
      expect(pack.note).toMatch(/arrange|renew/i);
      expect(pack.note).toContain('12 months');
    }
  });

  it('should price pack line-items at zero pence because packs are priced as a whole (RRP)', () => {
    const everyItem = onesearchPacks.flatMap((p) => p.items);
    expect(everyItem.every((i) => i.pricePence === 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Groundsure bundles — the PropXchain-branded price ladder
// ─────────────────────────────────────────────────────────────────────────────

describe('groundsureBundles', () => {
  it('should surface the four residential bundles ordered cheap to comprehensive', () => {
    expect(groundsureBundles.map((b) => b.id)).toEqual([
      'groundsure-homescreen',
      'groundsure-homebuyers',
      'groundsure-enviro-all-in-one',
      'groundsure-avista',
    ]);
  });

  it('should carry the RRP price ladder in strictly ascending pence order', () => {
    const prices = groundsureBundles.map((b) => b.pricePence);
    expect(prices).toEqual([6295, 9260, 9820, 13890]);
    const ascending = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(ascending);
  });

  it('should mark all bundles optional and not included', () => {
    expect(groundsureBundles.every((b) => b.category === 'optional')).toBe(true);
    expect(groundsureBundles.every((b) => !b.included)).toBe(true);
  });
});

describe('groundsureSingles', () => {
  it('should surface exactly seven single-topic add-ons', () => {
    expect(groundsureSingles).toHaveLength(7);
  });

  it('should price the three £40.50 core singles identically', () => {
    const byId = new Map(groundsureSingles.map((s) => [s.id, s.pricePence]));
    expect(byId.get('groundsure-planning')).toBe(4050);
    expect(byId.get('groundsure-flood')).toBe(4050);
    expect(byId.get('groundsure-energy-transportation-residential')).toBe(4050);
  });

  it('should price the two GeoRisk certificates at the £16.50 floor', () => {
    const byId = new Map(groundsureSingles.map((s) => [s.id, s.pricePence]));
    expect(byId.get('groundsure-georisk-cert-noncoal-stability')).toBe(1650);
    expect(byId.get('groundsure-georisk-cert-coal-brine')).toBe(1650);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Groundsure regionals — the postcode-conditional (area-specific) searches
// ─────────────────────────────────────────────────────────────────────────────

describe('groundsureRegionals (postcode-conditional area searches)', () => {
  it('should surface the six regional searches auto-added on postcode resolve', () => {
    expect(groundsureRegionals.map((r) => r.id)).toEqual([
      'groundsure-con29m-coal',
      'groundsure-cheshire-salt',
      'groundsure-metalliferous-mining',
      'groundsure-stone-mining',
      'groundsure-uxo-igne-preliminary',
      'groundsure-radoncheck',
    ]);
  });

  it('should tag every regional search as area-specific (the auto-detect category)', () => {
    expect(groundsureRegionals.every((r) => r.category === 'area-specific')).toBe(true);
  });

  it('should price coal, Cheshire salt and radon regionals at their RRPs', () => {
    const byId = new Map(groundsureRegionals.map((r) => [r.id, r.pricePence]));
    expect(byId.get('groundsure-con29m-coal')).toBe(4325);
    expect(byId.get('groundsure-cheshire-salt')).toBe(3750);
    expect(byId.get('groundsure-radoncheck')).toBe(350);
  });

  it('should price the two 48h regulated-mining searches at £75 each', () => {
    const byId = new Map(groundsureRegionals.map((r) => [r.id, r]));
    expect(byId.get('groundsure-metalliferous-mining')?.pricePence).toBe(7500);
    expect(byId.get('groundsure-stone-mining')?.pricePence).toBe(7500);
    expect(byId.get('groundsure-metalliferous-mining')?.turnaround).toBe('48 hrs');
    expect(byId.get('groundsure-stone-mining')?.turnaround).toBe('48 hrs');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groundsureCatalogue — the id → SearchItem convenience lookup
// ─────────────────────────────────────────────────────────────────────────────

describe('groundsureCatalogue', () => {
  it('should index every bundle, single and regional item by id', () => {
    const expectedIds = [
      ...groundsureBundles,
      ...groundsureSingles,
      ...groundsureRegionals,
    ].map((i) => i.id);
    expect(Object.keys(groundsureCatalogue).sort()).toEqual([...expectedIds].sort());
  });

  it('should contain 17 entries with no id collisions across the three lists', () => {
    const total =
      groundsureBundles.length + groundsureSingles.length + groundsureRegionals.length;
    expect(Object.keys(groundsureCatalogue)).toHaveLength(total);
    expect(total).toBe(17);
  });

  it('should map each id back to the exact SearchItem singleton', () => {
    expect(groundsureCatalogue['groundsure-avista']).toBe(groundsureBundles[3]);
    expect(groundsureCatalogue['groundsure-radoncheck']).toBe(groundsureRegionals[5]);
  });

  it('should return undefined for an id that is not a Groundsure product', () => {
    expect(groundsureCatalogue['not-a-real-id']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groundsureProductCodes + groundsureCodeFor — the worker order-code mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('groundsureProductCodes mapping', () => {
  it('should provide a worker report_type for every catalogue item id', () => {
    for (const id of Object.keys(groundsureCatalogue)) {
      expect(groundsureProductCodes[id], `code for ${id}`).toBeTypeOf('string');
      expect(groundsureProductCodes[id].length).toBeGreaterThan(0);
    }
  });

  it('should not map any code id that is absent from the catalogue (no orphan codes)', () => {
    for (const id of Object.keys(groundsureProductCodes)) {
      expect(groundsureCatalogue[id], `catalogue entry for ${id}`).toBeDefined();
    }
  });

  it('should map the documented bundle codes exactly', () => {
    expect(groundsureProductCodes['groundsure-homescreen']).toBe('hs');
    expect(groundsureProductCodes['groundsure-homebuyers']).toBe('homebuyers');
    expect(groundsureProductCodes['groundsure-enviro-all-in-one']).toBe('enviro_all_in_one_res');
    expect(groundsureProductCodes['groundsure-avista']).toBe('avista_res');
  });

  it('should map the regional codes exactly', () => {
    expect(groundsureProductCodes['groundsure-con29m-coal']).toBe('con29m_res');
    expect(groundsureProductCodes['groundsure-cheshire-salt']).toBe('cheshire_salt');
    expect(groundsureProductCodes['groundsure-metalliferous-mining']).toBe('metal');
    expect(groundsureProductCodes['groundsure-stone-mining']).toBe('stone');
    expect(groundsureProductCodes['groundsure-uxo-igne-preliminary']).toBe('igne_uxo');
    expect(groundsureProductCodes['groundsure-radoncheck']).toBe('rc');
  });

  it('should map distinct report_types to distinct ids (no code collisions)', () => {
    const codes = Object.values(groundsureProductCodes);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('groundsureCodeFor', () => {
  it('should resolve a known Groundsure item id to its worker report_type', () => {
    expect(groundsureCodeFor('groundsure-homebuyers')).toBe('homebuyers');
    expect(groundsureCodeFor('groundsure-flood')).toBe('flood');
  });

  it('should return undefined for a non-Groundsure item id', () => {
    expect(groundsureCodeFor('onesearch-llc1con29')).toBeUndefined();
    expect(groundsureCodeFor('la-con29r')).toBeUndefined();
  });

  it('should return undefined for an empty string', () => {
    expect(groundsureCodeFor('')).toBeUndefined();
  });

  it('should return undefined for an unknown id', () => {
    expect(groundsureCodeFor('totally-made-up')).toBeUndefined();
  });

  it('should agree with the underlying groundsureProductCodes map for every catalogue id', () => {
    for (const id of Object.keys(groundsureCatalogue)) {
      expect(groundsureCodeFor(id)).toBe(groundsureProductCodes[id]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OneSearch full catalogue — the tick-box "Searches" sub-card's data source.
// Pricing is deliberately unset until OneSearch confirms per-product trade prices, so these tests guard the
// *shape* and the not-orderable-yet invariant rather than any price value.
// ─────────────────────────────────────────────────────────────────────────────

describe('onesearchFullCatalogue', () => {
  it('should give every item a unique id and a unique PISCES code', () => {
    const ids = onesearchFullCatalogue.map((i) => i.id);
    const codes = onesearchFullCatalogue.map((i) => i.code);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('should never duplicate a code already sold via onesearchProvider/onesearchPacks', () => {
    const liveCodes = new Set(
      [
        ...onesearchProvider.standardPackSearches,
        ...onesearchProvider.additionalSearches,
        ...onesearchPacks.flatMap((p) => p.items),
      ]
        .map((s) => s.productType)
        .filter((code): code is string => Boolean(code)),
    );
    for (const item of onesearchFullCatalogue) {
      expect(liveCodes.has(item.code)).toBe(false);
    }
  });

  it('should leave every item unpriced and unorderable until trade prices are confirmed', () => {
    for (const item of onesearchFullCatalogue) {
      expect(item.tradePricePence).toBeNull();
      expect(item.retailPricePence).toBeNull();
      expect(item.orderable).toBe(false);
    }
  });

  it('should classify every item into a known segment', () => {
    for (const item of onesearchFullCatalogue) {
      expect(['residential', 'commercial', 'agricultural']).toContain(item.segment);
    }
  });

  it('should flag the OneSearch-routed Groundsure-branded products as duplicates', () => {
    const avista = onesearchFullCatalogue.find((i) => i.code === 'AVISTA');
    expect(avista?.groundsurePiscesDuplicate).toBe(true);
  });
});

describe('onesearchCatalogueByCode', () => {
  it('should look up a known item by its PISCES code', () => {
    expect(onesearchCatalogueByCode['LANDMARKCOAL']?.name).toBe('Landmark Coal');
  });

  it('should index every catalogue item', () => {
    expect(Object.keys(onesearchCatalogueByCode).length).toBe(onesearchFullCatalogue.length);
  });
});

describe('getResidentialOneSearchCatalogue', () => {
  it('should exclude commercial and agricultural items', () => {
    const residential = getResidentialOneSearchCatalogue();
    for (const item of residential) {
      expect(item.segment).toBe('residential');
    }
  });

  it('should exclude items that duplicate a Groundsure-direct product', () => {
    const residential = getResidentialOneSearchCatalogue();
    expect(residential.some((i) => i.code === 'AVISTA')).toBe(false);
  });

  it('should include an ordinary residential item like Landmark Coal', () => {
    const residential = getResidentialOneSearchCatalogue();
    expect(residential.some((i) => i.code === 'LANDMARKCOAL')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Type-surface sanity — ensure the exported interfaces stay usable without any
// ─────────────────────────────────────────────────────────────────────────────

describe('exported type surface', () => {
  it('should let a SearchProvider be typed and read without casting', () => {
    const provider: SearchProvider = tmGroupProvider;
    expect(provider.name).toBe('tmGroup');
  });

  it('should let a OneSearchPack be typed and read without casting', () => {
    const pack: OneSearchPack = onesearchPacks[0];
    expect(pack.id).toBe('standard');
  });

  it('should let a SearchItem be typed and read without casting', () => {
    const item: SearchItem = groundsureBundles[0];
    expect(item.id).toBe('groundsure-homescreen');
  });

  it('should let a OneSearchCatalogueItem be typed and read without casting', () => {
    const item: OneSearchCatalogueItem = onesearchFullCatalogue[0];
    expect(typeof item.code).toBe('string');
  });
});
