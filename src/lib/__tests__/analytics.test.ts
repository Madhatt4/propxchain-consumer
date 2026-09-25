import { beforeEach, describe, expect, it } from 'vitest';
import { trackPageView } from '../analytics';

describe('trackPageView', () => {
  beforeEach(() => {
    delete window.gtag;
    delete window.dataLayer;
  });

  it('should be a no-op when gtag is not present', () => {
    expect(() => trackPageView('/features')).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });

  it('should push a page_view event with path, location and title', () => {
    const layer: unknown[][] = [];
    window.gtag = (...args: unknown[]) => { layer.push(args); };
    trackPageView('/features?x=1', 'Features');
    expect(layer).toEqual([[
      'event',
      'page_view',
      { page_path: '/features?x=1', page_location: `${window.location.origin}/features?x=1`, page_title: 'Features' },
    ]]);
  });

  it('should omit page_title when no title is given', () => {
    const layer: unknown[][] = [];
    window.gtag = (...args: unknown[]) => { layer.push(args); };
    trackPageView('/');
    expect(layer[0][2]).toEqual({ page_path: '/', page_location: `${window.location.origin}/` });
  });
});
