// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getCoalMiningRisk, getRadonRisk, getSurfaceWaterRisk } from '../groundRiskService';

/** Response bodies below are trimmed copies of real replies captured on 4 Nov 2026. */

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => payload } as unknown as Response;
}

function lastUrl(): URL {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return new URL(String(calls[calls.length - 1][0]));
}

const YORK = { lat: 53.9604, lng: -1.0723, easting: 460800, northing: 452000 };

beforeEach(() => {
  window.localStorage.clear();
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('getSurfaceWaterRisk', () => {
  it('should read the band from a British National Grid point query, without geometry', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ type: 'FeatureCollection', features: [{ geometry: null, properties: { risk_band: 'Low', confidence: 3 } }] }),
    );

    const risk = await getSurfaceWaterRisk(YORK);

    expect(risk).toEqual({ band: 'low', confidence: 3 });
    const url = lastUrl();
    expect(url.searchParams.get('SRS')).toBe('EPSG:27700');
    expect(url.searchParams.get('BBOX')).toBe('460700,451900,460900,452100');
    expect(url.searchParams.get('propertyName')).toBe('risk_band,confidence');
  });

  it('should treat a point outside every mapped polygon as very low', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ type: 'FeatureCollection', features: [] }));

    expect(await getSurfaceWaterRisk(YORK)).toEqual({ band: 'very_low', confidence: null });
  });

  it('should fail rather than guess when there is no grid position', async () => {
    await expect(getSurfaceWaterRisk({ lat: 53.96, lng: -1.07 })).rejects.toThrow('British National Grid');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should surface a blocked or failed request as an error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, false, 403));

    await expect(getSurfaceWaterRisk(YORK)).rejects.toThrow('403');
  });

  it('should reject a band it does not recognise', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ features: [{ properties: { risk_band: 'Extreme' } }] }));

    await expect(getSurfaceWaterRisk(YORK)).rejects.toThrow('Unrecognised');
  });

  it('should serve a repeat check from the cache, sparing the rate-limited gateway', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ features: [{ properties: { risk_band: 'High', confidence: 2 } }] }));

    await getSurfaceWaterRisk(YORK);
    const again = await getSurfaceWaterRisk(YORK);

    expect(again.band).toBe('high');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('getCoalMiningRisk', () => {
  it('should report a high risk area when the point intersects one', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ features: [{ attributes: { FID: 13943 } }] }));

    expect(await getCoalMiningRisk({ lat: 53.8008, lng: -1.5491 })).toEqual({ inHighRiskArea: true });
    expect(lastUrl().searchParams.get('geometry')).toBe('-1.5491,53.8008');
  });

  it('should report no high risk area when nothing intersects', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ features: [] }));

    expect(await getCoalMiningRisk({ lat: 52.1286, lng: -0.2885 })).toEqual({ inHighRiskArea: false });
  });

  it('should treat an ArcGIS error body as a failure, not as "no risk"', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 499, message: 'Token Required' } }));

    await expect(getCoalMiningRisk({ lat: 53.8, lng: -1.55 })).rejects.toThrow('Token Required');
  });
});

describe('getRadonRisk', () => {
  it('should return the class, the atlas sentence and the 1 km square', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({
        features: [
          {
            attributes: {
              CLASS_MAX: 6,
              Description: 'Some parts of this 1km grid square are in bands of elevated radon potential.',
              TILE: 'SK0372',
            },
          },
        ],
      }),
    );

    expect(await getRadonRisk({ lat: 53.25, lng: -1.95 })).toEqual({
      classMax: 6,
      description: 'Some parts of this 1km grid square are in bands of elevated radon potential.',
      gridSquare: 'SK0372',
    });
  });

  it('should return null outside the atlas coverage', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ features: [] }));

    expect(await getRadonRisk({ lat: 49.9, lng: -6.3 })).toBeNull();
  });

  it('should ignore a class outside 1 to 6', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ features: [{ attributes: { CLASS_MAX: 9 } }] }));

    expect(await getRadonRisk({ lat: 52.1, lng: -0.3 })).toBeNull();
  });
});
