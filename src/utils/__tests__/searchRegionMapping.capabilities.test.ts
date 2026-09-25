import { describe, it, expect } from 'vitest';

import { getAreaCapabilities } from '@/utils/searchRegionMapping';
import type { LocalAuthorityInfo } from '@/services/postcodeService';

/** Minimal LocalAuthorityInfo — only the three fields the matcher reads. */
function la(overrides: Partial<LocalAuthorityInfo> = {}): LocalAuthorityInfo {
  return {
    postcode: 'SG19 1AB',
    adminDistrict: null,
    adminCounty: null,
    region: null,
    country: 'England',
    parish: null,
    ward: null,
    constituency: null,
    latitude: null,
    longitude: null,
    codes: { adminDistrict: null, adminCounty: null },
    ...overrides,
  };
}

describe('getAreaCapabilities', () => {
  it('should return an empty array for an area with no mining history', () => {
    expect(getAreaCapabilities(la({ adminDistrict: 'Central Bedfordshire' }))).toEqual([]);
  });

  it('should detect coal mining from the admin district', () => {
    expect(getAreaCapabilities(la({ adminDistrict: 'Barnsley' }))).toContain('coal-mining');
  });

  it('should detect coal mining from the admin county when the district does not match', () => {
    expect(
      getAreaCapabilities(la({ adminDistrict: 'Some Village', adminCounty: 'Nottinghamshire' })),
    ).toContain('coal-mining');
  });

  it('should detect brine extraction in the Cheshire salt field', () => {
    expect(getAreaCapabilities(la({ adminDistrict: 'Cheshire West and Chester' }))).toContain(
      'brine',
    );
  });

  it('should detect tin mining in Cornwall', () => {
    expect(getAreaCapabilities(la({ adminDistrict: 'Cornwall' }))).toContain('tin-mining');
  });

  it('should emit stone-mining, not limestone, for the Cotswold limestone belt', () => {
    const caps = getAreaCapabilities(la({ adminDistrict: 'Cotswold' }));
    expect(caps).toContain('stone-mining');
    expect(caps).not.toContain('limestone');
  });

  it('should return each capability at most once', () => {
    const caps = getAreaCapabilities(
      la({ adminDistrict: 'Derbyshire', adminCounty: 'Derbyshire', region: 'East Midlands' }),
    );
    expect(caps.length).toBe(new Set(caps).size);
  });

  it('should return an empty array when every location field is null', () => {
    expect(getAreaCapabilities(la())).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parity with the retired SearchesPanel.getCapabilitiesForArea.
//
// That function matched a hardcoded town list with `String.includes`. These
// cases are its ENTIRE input surface, transcribed from the pre-deletion source.
// Every one must still produce the same tag, or retiring it silently narrows
// coverage for real customers in those areas.
// ─────────────────────────────────────────────────────────────────────────────

// DELIBERATELY EXCLUDED from RETIRED_COAL_TOWNS: 'Wales' and 'Midlands'.
//
// The retired matcher used a plain `String.includes`, so those two entries
// coal-tagged whole countries and regions. `matchesAny` here is BIDIRECTIONAL
// — `item.includes(value) || value.includes(item)` — so porting them across
// would be worse, not equal: 'Midlands' would match a `region` of
// 'West Midlands' and coal-tag Herefordshire and Shropshire, and 'Wales'
// would coal-tag Anglesey and Pembrokeshire. Neither sits on a coalfield.
//
// COAL_MINING_DISTRICTS already names every Welsh and Midlands coal district
// individually, which is the correct granularity. These two were bugs in the
// old matcher, and parity with a bug would have us telling customers to buy a
// CON29M they do not need.
const RETIRED_COAL_TOWNS = [
  'Yorkshire',
  'Leeds',
  'Sheffield',
  'Barnsley',
  'Rotherham',
  'Doncaster',
  'Wakefield',
  'Bradford',
  'Durham',
  'Northumberland',
  'Newcastle',
  'Gateshead',
  'Sunderland',
  'Merthyr',
  'Rhondda',
  'Walsall',
  'Dudley',
  'Wolverhampton',
  'Sandwell',
  'Birmingham',
];

const RETIRED_BRINE_TOWNS = ['Cheshire', 'Northwich', 'Middlewich', 'Winsford'];

const RETIRED_TIN_TOWNS = ['Cornwall', 'Penwith', 'Kerrier', 'Carrick'];

const RETIRED_STONE_TOWNS = ['Cotswold', 'Bath', 'Somerset', 'Derbyshire'];

describe('getAreaCapabilities parity with the retired panel matcher', () => {
  it.each(RETIRED_COAL_TOWNS)('should still tag %s as coal-mining', (town) => {
    expect(getAreaCapabilities(la({ adminDistrict: town }))).toContain('coal-mining');
  });

  it.each(RETIRED_BRINE_TOWNS)('should still tag %s as brine', (town) => {
    expect(getAreaCapabilities(la({ adminDistrict: town }))).toContain('brine');
  });

  it.each(RETIRED_TIN_TOWNS)('should still tag %s as tin-mining', (town) => {
    expect(getAreaCapabilities(la({ adminDistrict: town }))).toContain('tin-mining');
  });

  it.each(RETIRED_STONE_TOWNS)('should still tag %s as stone-mining', (town) => {
    expect(getAreaCapabilities(la({ adminDistrict: town }))).toContain('stone-mining');
  });
});
