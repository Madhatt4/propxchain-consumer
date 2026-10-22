// Run: node --test tools/agent-tier/derive-tier.test.mjs
//
// The fail-closed behaviour is the security-critical property here: an
// unmatched path MUST resolve to the highest tier. If this suite ever goes
// green with an unmatched path returning 0, agent autonomy has silently
// widened to cover code nobody classified.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tierForPath, UNMATCHED_TIER } from './derive-tier.mjs';

describe('tierForPath — fail-closed default', () => {
  test('should resolve an unmatched path to the highest tier', () => {
    const result = tierForPath('unknown/thing.bin');

    assert.equal(result.tier, UNMATCHED_TIER);
    assert.equal(result.tier, 3);
    assert.match(result.rule, /unmatched/);
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
  ];

  for (const [path, expected] of cases) {
    test(`should classify ${path} as tier ${expected}`, () => {
      assert.equal(tierForPath(path).tier, expected);
    });
  }
});
