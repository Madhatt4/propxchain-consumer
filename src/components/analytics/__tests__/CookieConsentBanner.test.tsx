// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CookieConsentBanner } from '../CookieConsentBanner';
import { ANALYTICS_CONSENT_KEY, clearAnalyticsConsent, readAnalyticsConsent } from '@/lib/analyticsConsent';

function renderBanner(): void {
  render(
    <MemoryRouter>
      <CookieConsentBanner />
    </MemoryRouter>,
  );
}

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should ask a visitor who has not chosen yet', () => {
    renderBanner();

    expect(screen.getByRole('region', { name: 'Cookie choice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
  });

  it('should stay hidden once the visitor has chosen', () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, 'denied');

    renderBanner();

    expect(screen.queryByRole('region', { name: 'Cookie choice' })).not.toBeInTheDocument();
  });

  it('should record an acceptance and disappear', () => {
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(readAnalyticsConsent()).toBe('granted');
    expect(screen.queryByRole('region', { name: 'Cookie choice' })).not.toBeInTheDocument();
  });

  it('should record a rejection and disappear', () => {
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(readAnalyticsConsent()).toBe('denied');
    expect(screen.queryByRole('region', { name: 'Cookie choice' })).not.toBeInTheDocument();
  });

  it('should come back when the visitor resets their choice', () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    renderBanner();

    act(() => clearAnalyticsConsent());

    expect(screen.getByRole('region', { name: 'Cookie choice' })).toBeInTheDocument();
  });
});
