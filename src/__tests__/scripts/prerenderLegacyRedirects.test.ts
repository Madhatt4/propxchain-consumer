// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  legacyRedirectHtml,
  legacyRedirectFile,
} from '../../../scripts/prerender-legacy-redirects.mjs';
import { LEGACY_GUIDE_ROUTES } from '../../pages/resources/resourcesMeta';

describe('legacy /guides redirect pages', () => {
  it('should point the canonical at the new absolute URL', () => {
    const html = legacyRedirectHtml('/resources/industry-and-reform/baspi-explained');

    expect(html).toContain(
      '<link rel="canonical" href="https://propxchain.com/resources/industry-and-reform/baspi-explained" />',
    );
  });

  it('should refresh immediately to the new path', () => {
    const html = legacyRedirectHtml('/resources/selling/property-information-forms-explained');

    expect(html).toContain(
      '<meta http-equiv="refresh" content="0; url=/resources/selling/property-information-forms-explained" />',
    );
  });

  it('should not carry the SPA shell or a noindex that would block the redirect', () => {
    const html = legacyRedirectHtml('/resources');

    expect(html).not.toContain('seo-fallback');
    expect(html).not.toContain('noindex');
  });

  it('should write each legacy path to its own index.html under dist', () => {
    expect(legacyRedirectFile('/guides')).toBe(join('guides', 'index.html'));
    expect(legacyRedirectFile('/guides/baspi-explained')).toBe(
      join('guides', 'baspi-explained', 'index.html'),
    );
  });

  it('should cover the duplicate property-information-forms URL seen in Search Console', () => {
    expect(LEGACY_GUIDE_ROUTES['/guides/property-information-forms-explained']).toBe(
      '/resources/selling/property-information-forms-explained',
    );
  });
});
