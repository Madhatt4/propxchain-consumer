// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_KEY,
  clearAnalyticsConsent,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from '../analyticsConsent';

describe('analyticsConsent', () => {
  let gtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  beforeEach(() => {
    window.localStorage.clear();
    gtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = gtag;
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('should read no choice when nothing is stored', () => {
    expect(readAnalyticsConsent()).toBeNull();
  });

  it('should ignore an unrecognised stored value', () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, 'maybe');

    expect(readAnalyticsConsent()).toBeNull();
  });

  it('should store an acceptance and switch analytics storage on', () => {
    saveAnalyticsConsent('granted');

    expect(readAnalyticsConsent()).toBe('granted');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' });
  });

  it('should store a rejection and keep analytics storage off', () => {
    saveAnalyticsConsent('denied');

    expect(readAnalyticsConsent()).toBe('denied');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'denied' });
  });

  it('should announce a change so the banner can react', () => {
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, listener);

    saveAnalyticsConsent('granted');
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should forget the choice and switch analytics storage off when cleared', () => {
    saveAnalyticsConsent('granted');

    clearAnalyticsConsent();

    expect(readAnalyticsConsent()).toBeNull();
    expect(gtag).toHaveBeenLastCalledWith('consent', 'update', { analytics_storage: 'denied' });
  });

  it('should still store the choice when gtag is blocked', () => {
    delete window.gtag;

    saveAnalyticsConsent('granted');

    expect(readAnalyticsConsent()).toBe('granted');
  });
});
