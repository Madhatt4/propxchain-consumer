// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The public pages and the sign-up steps use the PropXchain teal for their
 * actions and highlights. Tailwind's default blue, indigo and purple crept in
 * on pages built before the brand settled; this keeps them out, so a button on
 * the pricing page or a sign-up step cannot drift off-brand again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PUBLIC_FILES = [
  'pages/PricingPage.tsx',
  'pages/PropertyCheckPage.tsx',
  'pages/CompliancePage.tsx',
  'pages/PartnersPage.tsx',
  'pages/SalesPage.tsx',
  'pages/SupportPage.tsx',
  'pages/PrivacyPolicyPage.tsx',
  'pages/TermsOfServicePage.tsx',
  'pages/marketing/MarketingHeader.tsx',
  'pages/marketing/MarketingFooter.tsx',
  'components/brand/Logo.tsx',
  'components/auth/CredentialStep.tsx',
  'components/auth/PricingStep.tsx',
  'components/auth/SolicitorOnboarding.tsx',
];

const OFF_BRAND = /\b(?:[a-z]+:)*(?:bg|text|border|from|to|via|ring|shadow|outline)-(?:blue|indigo|purple|violet|sky)-\d{2,3}\b/g;

describe('public page brand colours', () => {
  it.each(PUBLIC_FILES)('should use no Tailwind blue, indigo or purple in %s', (file) => {
    const code = readFileSync(resolve(src, file), 'utf8');

    expect(code.match(OFF_BRAND) ?? []).toEqual([]);
  });
});
