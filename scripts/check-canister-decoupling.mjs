#!/usr/bin/env node
/**
 * Guard: production code reaches canisters through @propxchain/core-client only.
 *
 * WHY THIS EXISTS
 * ---------------
 * The contributor rules have carried this since the A3.1 decoupling, stated as an audit
 * command that "must always return zero hits". Nothing ever ran it. It drifted
 * twice: chainEntitlement.service.ts (2026-07-07, #112) and — until the same
 * sweep — a handful of near-misses. A documented check that nobody executes is
 * not a check, which is the lesson this repo keeps relearning.
 *
 * WHAT IT CHECKS, AND WHAT IT DELIBERATELY DOES NOT
 * -------------------------------------------------
 * It looks for real module IMPORTS, not textual mentions. `logbook.service.ts`
 * carries a comment explaining why it builds its IDL against the namespace
 * core-client's Actor injects rather than against `@dfinity/candid` — that
 * comment is the decoupling working and being documented. A text-level grep
 * fails the build on it, which would punish exactly the writing we want.
 *
 * Scope is canister ACCESS, not the whole `@dfinity` npm scope:
 *   banned  @dfinity/agent, @dfinity/candid, *.did.js, src/declarations/*
 *   allowed @dfinity/vetkeys — VetKD crypto primitives, no actor or canister
 *           coupling, and nothing core-client wraps or should wrap.
 *
 * Test files are out of scope: they are not shipped, and constructing an IDL
 * fixture from the raw types is legitimate. The rule protects the bundle.
 */

import { readFileSync, readdirSync } from 'node:fs';

/**
 * Files permitted to import canister plumbing directly, each with the reason
 * and what would retire the entry. This list is DEBT, not policy — an addition
 * needs the same justification and should be argued for, not appended quietly.
 */
const ALLOWLIST = {
  'src/services/chainEntitlement.service.ts':
    'Builds its own Actor for the entitlement canister. core-client exposes no ' +
    'entitlement wrapper (checked at 0.3.0-canary.37), so the documented route — ' +
    'extend packages/core-client in the monorepo, publish a canary — was skipped ' +
    'when the VMC chain-unlock paywall shipped (#112, 2026-07-07). Retire this ' +
    'entry by adding the wrapper and consuming it here.',
};

const BANNED_SPECIFIERS = [/^@dfinity\/agent$/, /^@dfinity\/candid$/];
const BANNED_PATHS = [/\.did\.js$/, /(^|\/)declarations\//];

/** Strip comments so a line explaining the rule cannot trip it. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every module specifier a file imports — static, side-effect, re-export and dynamic. */
function importedSpecifiers(src) {
  const code = stripComments(src);
  const found = new Set();
  // `from '…'` covers static imports (including multi-line ones, which a
  // line-oriented matcher misses) and re-exports.
  for (const m of code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
  // Side-effect imports: `import '…'`
  for (const m of code.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) found.add(m[1]);
  // Dynamic: `import('…')`
  for (const m of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
  return [...found];
}

// `readdirSync(..., { recursive: true })` rather than `fs.globSync`: glob
// landed in Node 22 and CI pins Node 20, so globSync is undefined there. The
// first version used it and took main red on merge — it passed locally only
// because this machine runs Node 24.
const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => `src/${String(f).replaceAll('\\', '/')}`)
  .filter((f) => /[.]tsx?$/.test(f))
  .filter((f) => !f.includes('__tests__') && !/[.]test[.]tsx?$/.test(f));

const violations = [];
for (const file of files) {
  const specifiers = importedSpecifiers(readFileSync(file, 'utf8'));
  const bad = specifiers.filter(
    (s) => BANNED_SPECIFIERS.some((re) => re.test(s)) || BANNED_PATHS.some((re) => re.test(s)),
  );
  if (bad.length && !ALLOWLIST[file]) violations.push({ file, bad });
}

// A stale allowlist is its own failure: it reads as active debt when the debt is
// gone, and the next person trusts it. Fail so the entry gets deleted.
const stale = Object.keys(ALLOWLIST).filter((f) => {
  if (!files.includes(f)) return true;
  const specifiers = importedSpecifiers(readFileSync(f, 'utf8'));
  return !specifiers.some(
    (s) => BANNED_SPECIFIERS.some((re) => re.test(s)) || BANNED_PATHS.some((re) => re.test(s)),
  );
});

if (violations.length === 0 && stale.length === 0) {
  const n = Object.keys(ALLOWLIST).length;
  console.log(`canister decoupling OK — ${files.length} files, ${n} allowlisted (see scripts/check-canister-decoupling.mjs)`);
  process.exit(0);
}

for (const { file, bad } of violations) {
  console.error(`::error file=${file}::imports canister plumbing directly: ${bad.join(', ')}`);
}
if (violations.length) {
  console.error(`
Production code must reach canisters through @propxchain/core-client.

If core-client does not wrap what you need, the documented route is:
  1. extend packages/core-client/ in the monorepo
  2. publish a canary
  3. pnpm up @propxchain/core-client@canary

Importing @dfinity/agent or @dfinity/candid here is the shortcut that route
exists to prevent. If it is genuinely unavoidable, add the file to ALLOWLIST in
scripts/check-canister-decoupling.mjs WITH the reason and what would retire it —
and expect to justify it in review.

@dfinity/vetkeys is fine: crypto primitives, not canister access.`);
}
for (const file of stale) {
  console.error(`::error::${file} is allowlisted but no longer needs to be — delete its ALLOWLIST entry.`);
}
process.exit(1);
