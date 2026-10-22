// Run: npx vitest run tools/agent-tier/derive-tier.test.mjs
//
// The fail-closed behaviour is the security-critical property here: an
// unmatched path MUST resolve to the highest tier. If this suite ever goes
// green with an unmatched path returning 0, agent autonomy has silently
// widened to cover code nobody classified.

import { describe, it, expect } from 'vitest';
import { tierForPath, UNMATCHED_TIER } from './derive-tier.mjs';

describe('tierForPath — fail-closed default', () => {
  it('should resolve an unmatched path to the highest tier', () => {
    const result = tierForPath('unknown/thing.bin');

    expect(result.tier).toBe(UNMATCHED_TIER);
    expect(result.tier).toBe(3);
    expect(result.rule).toMatch(/unmatched/);
  });
});

describe('tierForPath — classification', () => {
  const cases = [
    ['docs/a.md', 0],
    // Highest tier wins: a test file inside an auth directory is still auth.
    ['src/components/auth/__tests__/x.test.tsx', 3],
    ['src/components/ui/Button.tsx', 1],
    ['src/lib/x.ts', 1],
    ['src/services/api.ts', 2],
    ['supabase/migrations/x.sql', 2],
    ['src/pages/payment/Pay.tsx', 3],
    ['dfx.json', 3],
    ['canister_ids.json', 3],
    ['android/app/build.gradle', 3],
    ['README.md', 0],
    ['unknown/thing.bin', 3],
    // Tightened 2026-10-22: served identity files, CSP, admin, wallet/signing, auth utils.
    ['public/.well-known/ii-alternative-origins', 3],
    ['public/.ic-assets.json5', 3],
    ['src/pages/admin/SagasPage.tsx', 3],
    ['src/pages/WalletProofPage.tsx', 3],
    ['src/utils/auth.ts', 3],
    ['src/lib/supabase.ts', 2],
    // Regression: ordinary public assets and pages stay tier 1.
    ['public/favicon.ico', 1],
    ['src/pages/AboutPage.tsx', 1],
  ];

  for (const [path, expected] of cases) {
    it(`should classify ${path} as tier ${expected}`, () => {
      expect(tierForPath(path).tier).toBe(expected);
    });
  }
});
