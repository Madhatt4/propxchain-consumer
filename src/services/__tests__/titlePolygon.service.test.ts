import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getTitleBoundary } from '../titlePolygon.service';

const WORKER = 'https://inspire-title.test.workers.dev';

const POLY = {
  type: 'Polygon',
  coordinates: [
    [
      [-0.135, 51.5095],
      [-0.133, 51.5095],
      [-0.133, 51.5105],
      [-0.135, 51.5105],
      [-0.135, 51.5095],
    ],
  ],
};

function workerBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    inspireId: 42,
    geometry: POLY,
    wkt4326: 'POLYGON((-0.135 51.5095, -0.133 51.5095, -0.133 51.5105, -0.135 51.5105, -0.135 51.5095))',
    wkt27700: 'POLYGON((530000 180000, 530140 180000, 530140 180110, 530000 180110, 530000 180000))',
    areaSqMetres: 251.73,
    source: 'inspire-polygon',
    ...over,
  };
}

const originalFetch = globalThis.fetch;

describe('getTitleBoundary (worker)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TITLE_WORKER_URL', WORKER);
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
  });

  it('maps a worker hit to a TitleBoundary and derives the bbox', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => workerBody(),
    });

    const tb = await getTitleBoundary(51.51, -0.134);

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      `${WORKER}/title?lat=51.51&lng=-0.134`,
    );
    expect(tb?.inspireId).toBe(42);
    expect(tb?.source).toBe('inspire-polygon');
    expect(tb?.geojson.type).toBe('Polygon');
    expect(tb?.wkt4326).toContain('-0.135 51.5095');
    expect(tb?.bboxWkt4326).toBe(
      'POLYGON((-0.135 51.5095, -0.133 51.5095, -0.133 51.5105, -0.135 51.5105, -0.135 51.5095))',
    );
  });

  it('returns null when the worker reports no polygon (null body)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => null });
    expect(await getTitleBoundary(51.51, -0.134)).toBeNull();
  });

  it('returns null on a non-200 from the worker', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });
    expect(await getTitleBoundary(51.51, -0.134)).toBeNull();
  });

  it('returns null when the worker URL is not configured', async () => {
    vi.stubEnv('VITE_TITLE_WORKER_URL', '');
    expect(await getTitleBoundary(51.51, -0.134)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('short-circuits on non-finite input without calling fetch', async () => {
    expect(await getTitleBoundary(Number.NaN, -0.134)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

/** Both fields arrived with monorepo #199; the Groundsure path depends on them. */
describe('getTitleBoundary — BNG outline and area', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TITLE_WORKER_URL', WORKER);
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  const respond = (body: unknown) => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => body,
    });
  };

  it('should carry the BNG outline and area through from the worker', async () => {
    respond(workerBody());
    const result = await getTitleBoundary(51.51, -0.134);
    expect(result?.wkt27700).toContain('530000 180000');
    expect(result?.areaSqMetres).toBe(251.73);
  });

  it('should null both when a worker predating #199 omits them', async () => {
    // Not a failure: the caller degrades to the UPRN box rather than sending
    // Groundsure a WGS84 outline it would accept and price.
    respond({ inspireId: 42, geometry: POLY, wkt4326: 'POLYGON((0 0, 1 0, 1 1, 0 0))', source: 'inspire-polygon' });
    const result = await getTitleBoundary(51.51, -0.134);
    expect(result).not.toBeNull();
    expect(result?.wkt27700).toBeNull();
    expect(result?.areaSqMetres).toBeNull();
  });

  it('should reject a non-numeric area rather than pass it on', async () => {
    respond(workerBody({ areaSqMetres: 'not a number' }));
    const result = await getTitleBoundary(51.51, -0.134);
    expect(result?.areaSqMetres).toBeNull();
  });
});
