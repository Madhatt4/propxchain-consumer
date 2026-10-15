import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Inputs for pricingClaims.test.ts: the customer-facing marketing sources
 * that state PropXchain's price, and the phrases none of them may contain.
 *
 * In-app flows (hooks, tabs, onboarding payment) are not listed: they are
 * functional gates removed in their own PR, and their copy goes with them.
 */

export const MARKETING_SOURCES: readonly string[] = [
  'index.html',
  'public/llms.txt',
  'public/llms-full.txt',
  'scripts/prerender-marketing.mjs',
  'scripts/prerender-resources.mjs',
  'src/constants/pricing.ts',
  'src/lib/webmcp.ts',
  'src/pages/PricingPage.tsx',
  'src/pages/SalesPage.tsx',
  'src/pages/SellMyHousePage.tsx',
  'src/pages/AboutPage.tsx',
  'src/pages/FeaturesPage.tsx',
  'src/pages/SupportPage.tsx',
  'src/pages/marketing/faqData.mjs',
  'src/pages/marketing/FaqPage.tsx',
  'src/pages/resources/BaspiGuide.tsx',
  'src/pages/resources/ConveyancingTimelineGuide.tsx',
  'src/pages/resources/PropertyPackGuide.tsx',
  'src/pages/resources/PropertySearchesGuide.tsx',
  'src/pages/resources/ResourceLayout.tsx',
  'src/pages/resources/TA6FormGuide.tsx',
  'src/components/landing/HeroShowcase.tsx',
  'src/components/landing/marketing/data.ts',
  'src/components/landing/marketing/PricingSection.tsx',
  'src/components/landing/marketing/HeroSection.tsx',
  'src/components/landing/marketing/AudienceSections.tsx',
  'src/components/providers/TmGroupPackPicker.tsx',
  'src/components/providers/TmGroupQuoteSummary.tsx',
];

/** Phrases that sell a tier PropXchain no longer has. */
export const PAID_TIER_CLAIMS: readonly RegExp[] = [
  /£\s?75\b/,
  /\b75\s?GBP\b|\bGBP\s?75\b/,
  /Premium (tier|plan|co-?pilot|AI)/i,
  /Starter (tier|plan)/i,
  /AI co-?pilot/i,
  /upgrade (to|whenever)/i,
  /subscription (tiers|plans|manager)/i,
];

/** Searches carry a margin, so each of these is untrue. */
export const NO_MARKUP_CLAIMS: readonly RegExp[] = [
  /\bat cost\b/i,
  /no (hidden )?(platform )?mark-?up/i,
  /never mark(s|ed)? (it |that )?up/i,
  /pass-through/i,
  /supplier price/i,
];

/**
 * Drops code comments, which may name a banned phrase in order to forbid it
 * ("never claim 'no mark-up'"). Line comments are only stripped when they
 * start a line, so the `//` inside an https:// URL in copy is left alone.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every `file: "match"` where a marketing source contains one of `patterns`. */
export function findClaims(patterns: readonly RegExp[]): string[] {
  const offenders: string[] = [];
  for (const file of MARKETING_SOURCES) {
    const text = stripComments(readFileSync(join(process.cwd(), file), 'utf8'));
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) offenders.push(`${file}: "${match[0]}"`);
    }
  }
  return offenders;
}
