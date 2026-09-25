import { describe, expect, it } from 'vitest';

import { basemapTiles } from '../basemapTiles';

describe('basemapTiles', () => {
  it('should fall back to OpenStreetMap tiles when no CARTO key is set', () => {
    const tiles = basemapTiles(false, 'street', undefined);

    expect(tiles.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(tiles.attribution).not.toContain('CARTO');
  });

  it('should treat an empty or whitespace key as missing', () => {
    expect(basemapTiles(false, 'street', '').url).toContain('tile.openstreetmap.org');
    expect(basemapTiles(true, 'boundary', '   ').url).toContain('tile.openstreetmap.org');
  });

  it('should use CARTO Voyager with the key for the light street view', () => {
    const tiles = basemapTiles(false, 'street', 'abc123');

    expect(tiles.url).toBe(
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=abc123',
    );
    expect(tiles.attribution).toContain('CARTO');
  });

  it('should use CARTO Positron for the light boundary view', () => {
    expect(basemapTiles(false, 'boundary', 'abc123').url).toContain('/rastertiles/light_all/');
  });

  it('should use CARTO dark for both views in dark theme', () => {
    expect(basemapTiles(true, 'street', 'abc123').url).toContain('/rastertiles/dark_all/');
    expect(basemapTiles(true, 'boundary', 'abc123').url).toContain('/rastertiles/dark_all/');
  });

  it('should URL-encode the key', () => {
    expect(basemapTiles(false, 'street', 'a b&c').url).toMatch(/\?key=a%20b%26c$/);
  });
});
