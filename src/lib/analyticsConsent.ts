// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export type AnalyticsConsent = 'granted' | 'denied';

export const ANALYTICS_CONSENT_KEY = 'propxchain_analytics_consent';
export const ANALYTICS_CONSENT_EVENT = 'propxchain:analytics-consent-changed';

export function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(choice: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
  } catch {
    return;
  }
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: choice });
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

export function clearAnalyticsConsent(): void {
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    return;
  }
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}
