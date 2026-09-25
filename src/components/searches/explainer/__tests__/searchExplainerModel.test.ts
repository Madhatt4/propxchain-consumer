import { describe, it, expect } from 'vitest';

import { buildExplainerModel } from '../searchExplainerModel';
import type { LocationSearchAnalysis, LocalAuthorityInfo } from '@/services/postcodeService';

function analysis(
  recommendations: LocationSearchAnalysis['recommendations'],
): LocationSearchAnalysis {
  const localAuthority: LocalAuthorityInfo = {
    postcode: 'S70 1AA',
    adminDistrict: 'Barnsley',
    adminCounty: null,
    region: null,
    country: 'England',
    parish: null,
    ward: null,
    constituency: null,
    latitude: null,
    longitude: null,
    codes: { adminDistrict: null, adminCounty: null },
  };
  return { localAuthority, recommendations, warnings: [], additionalInfo: [] };
}

describe('buildExplainerModel', () => {
  it('should group a required recommendation under required', () => {
    const model = buildExplainerModel(
      analysis([
        {
          searchTypeId: 'local-authority-search',
          reason: 'Required for all property transactions',
          priority: 'required',
          confidence: 'high',
        },
      ]),
    );
    expect(model.required.map((e) => e.searchType.id)).toEqual(['local-authority-search']);
    expect(model.recommended).toEqual([]);
  });

  it('should group a recommended recommendation under recommended', () => {
    const model = buildExplainerModel(
      analysis([
        {
          searchTypeId: 'chancel-repair',
          reason: 'Historic parish nearby',
          priority: 'recommended',
          confidence: 'medium',
        },
      ]),
    );
    expect(model.recommended.map((e) => e.searchType.id)).toEqual(['chancel-repair']);
    expect(model.required).toEqual([]);
  });

  it('should mark a low-confidence entry as hedged', () => {
    const model = buildExplainerModel(
      analysis([
        {
          searchTypeId: 'chancel-repair',
          reason: 'Possible historic parish',
          priority: 'recommended',
          confidence: 'low',
        },
      ]),
    );
    expect(model.recommended[0].hedged).toBe(true);
  });

  it('should not mark a high-confidence entry as hedged', () => {
    const model = buildExplainerModel(
      analysis([
        {
          searchTypeId: 'coal-mining-con29m',
          reason: 'Barnsley is in a coal mining affected area',
          priority: 'required',
          confidence: 'high',
        },
      ]),
    );
    expect(model.required[0].hedged).toBe(false);
  });

  it('should list an unrecommended location-specific search as not needed', () => {
    const model = buildExplainerModel(
      analysis([
        {
          searchTypeId: 'coal-mining-con29m',
          reason: 'Coal area',
          priority: 'required',
          confidence: 'high',
        },
      ]),
    );
    const notNeededIds = model.notNeeded.map((s) => s.id);
    expect(notNeededIds).toContain('tin-mining');
    expect(notNeededIds).not.toContain('coal-mining-con29m');
  });

  it('should never list an essential search as not needed', () => {
    const model = buildExplainerModel(analysis([]));
    expect(model.notNeeded.map((s) => s.id)).not.toContain('local-authority-search');
  });

  it('should drop a recommendation whose search type id is unknown', () => {
    const model = buildExplainerModel(
      analysis([
        {
          searchTypeId: 'not-a-real-search',
          reason: 'nonsense',
          priority: 'required',
          confidence: 'high',
        },
      ]),
    );
    expect(model.required).toEqual([]);
  });

  it('should return empty groups for an analysis with no recommendations', () => {
    const model = buildExplainerModel(analysis([]));
    expect(model.required).toEqual([]);
    expect(model.recommended).toEqual([]);
  });
});
