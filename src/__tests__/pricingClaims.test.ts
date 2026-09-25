import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pricing copy is a claim, and the wrong claim is a defect that ships silently.
 *
 * On 2026-08-30 the onboarding role picker told sellers "£75 platform fee per
 * transaction" while telling buyers "Free — no platform fee", months after the
 * model became free-for-everyone with an optional £75 AI co-pilot. Every
 * marketing page said the right thing; the two in-app flows a seller actually
 * walks through said the opposite, so the contradiction was invisible to anyone
 * reading the site rather than using it.
 *
 * Guarded here rather than per-component because the failure is a phrase
 * appearing anywhere, not a specific component rendering wrongly.
 *
 * The canonical position (memory: project_pricing_model):
 *   Starter  — free for EVERY party. Providers paid direct at published rates.
 *   Premium  — £75 per transaction, an AI co-pilot. Not a platform fee, not a
 *              bundling or orchestration fee, and not seller-only.
 */

// Not `fs.globSync`: it landed in Node 22 and CI pins Node 20, where it is
// undefined. This passed locally on Node 24 and took main red on merge.
function sourceFiles(): string[] {
  return readdirSync('src', { recursive: true, encoding: 'utf8' })
    // Not `replaceAll` — this project's tsconfig lib target predates it.
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((f) => /[.]tsx?$/.test(f))
    .filter((f) => !f.includes('__tests__') && !f.includes('.test.'))
    .map((f) => join(process.cwd(), 'src', f));
}

describe('pricing copy claims', () => {
  it(
    'should never describe the £75 as a platform fee',
    () => {
    // "no platform fee" is correct and must stay allowed — it is the Starter
    // claim. What must never appear is £75 attached to the words platform fee.
    //
    // Checked against whitespace-normalised text, not line by line: prose wraps,
    // and a per-line check flagged BaspiGuide's correct "free with no / platform
    // fee, and the optional £75 AI co-pilot" purely because the "no" fell on the
    // previous line.
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8').replace(/\s+/g, ' ');
      for (const match of text.matchAll(/(?<!no\s)platform\s+fee/gi)) {
        const from = Math.max(0, match.index - 80);
        const window = text.slice(from, match.index + 80);
        if (/£\s?75/.test(window)) {
          offenders.push(`${file}: …${window.trim()}…`);
        }
      }
    }
    expect(offenders, `£75 described as a platform fee:\n${offenders.join('\n')}`).toEqual([]);
    },
    // Scans every source file on disk; under full-suite parallel load the
    // reads alone exceed the 5s default (seen at 8.8s) — the assertion is
    // unchanged, only the allowance for filesystem latency.
    30000,
  );

  it('should not charge one side of the transaction and not the other', () => {
    // The specific defect: the seller card carried a price, the buyer card said
    // free. Starter is free for every party — a role picker that prices one role
    // is wrong regardless of the number on it.
    const rolePicker = readFileSync(
      join(process.cwd(), 'src/pages/onboarding/RoleSelectionPage.tsx'),
      'utf8',
    );
    expect(rolePicker).not.toMatch(/£\s?75\s*platform fee/i);
    // Both role cards make the same free-to-start claim.
    const freeClaims = rolePicker.match(/Free — no platform fee/g) ?? [];
    expect(freeClaims.length).toBe(2);
  });
});
