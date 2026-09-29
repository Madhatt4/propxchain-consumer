import { beforeEach, describe, expect, it } from 'vitest';
import { trackPageView, trackSignUp, trackWaitlistJoin } from '../analytics';

describe('trackSignUp / trackWaitlistJoin', () => {
  beforeEach(() => {
    delete window.gtag;
  });

  it('should be no-ops when gtag is not present', () => {
    expect(() => trackSignUp('email')).not.toThrow();
    expect(() => trackWaitlistJoin('landing_page', 'seller')).not.toThrow();
  });

  it('should send sign_up with only the method', () => {
    const layer: unknown[][] = [];
    window.gtag = (...args: unknown[]) => { layer.push(args); };
    trackSignUp('google');
    expect(layer).toEqual([['event', 'sign_up', { method: 'google' }]]);
  });

  it('should send join_waitlist with source and role, defaulting to unknown', () => {
    const layer: unknown[][] = [];
    window.gtag = (...args: unknown[]) => { layer.push(args); };
    trackWaitlistJoin('sellers_page', 'seller');
    trackWaitlistJoin(null, undefined);
    expect(layer).toEqual([
      ['event', 'join_waitlist', { waitlist_source: 'sellers_page', waitlist_role: 'seller' }],
      ['event', 'join_waitlist', { waitlist_source: 'unknown', waitlist_role: 'unknown' }],
    ]);
  });
});

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
