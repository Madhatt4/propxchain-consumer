#!/usr/bin/env node
/**
 * derive-tier — resolve the danger tier of a set of changed paths.
 *
 * Tier governs how much autonomy an agent worker gets on a card:
 *   0  autonomous, may auto-merge
 *   1  autonomous, PR required
 *   2  PR + required human review
 *   3  PR + review + escalation; irreversible or billed surfaces
 *
 * FAIL-CLOSED: a path matching no rule resolves to tier 3, not tier 0. An
 * unknown path is an unknown blast radius, and the whole point of this file is
 * to be wrong in the safe direction.
 *
 * This is a ROUTER, not the enforcement mechanism. Real enforcement is the
 * absence of deploy credentials from the agent's launch profile.
 *
 * Usage:
 *   node derive-tier.mjs <path>...          max tier for those paths
 *   node derive-tier.mjs --stdin            read newline-separated paths
 *   node derive-tier.mjs --commits [N]      distribution over last N commits
 *   node derive-tier.mjs --explain <path>   show which rule matched
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(readFileSync(join(HERE, 'tier-map.json'), 'utf8'));

export const UNMATCHED_TIER = 3;
export const MAX_TIER = 3;

/**
 * Minimal glob -> RegExp. Supports `**`, `*` and `?`.
 * `**` crosses directory separators; `*` does not.
 */
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` should also match zero directories, so foo/**/bar matches foo/bar
        if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

const COMPILED = MAP.rules.map((r) => ({ tier: r.tier, glob: r.glob, re: globToRegExp(r.glob) }));

/** Tier for a single path. Highest matching rule wins; unmatched => fail closed. */
export function tierForPath(path) {
  const norm = String(path).replace(/\\/g, '/').replace(/^\.\//, '');
  let tier = null;
  let matched = null;
  for (const rule of COMPILED) {
    if (rule.re.test(norm) && (tier === null || rule.tier > tier)) {
      tier = rule.tier;
      matched = rule.glob;
    }
  }
  return tier === null
    ? { tier: UNMATCHED_TIER, rule: '(unmatched — fail closed)' }
    : { tier, rule: matched };
}

/** Max tier across a change set. An empty set is tier 0 (nothing to do). */
export function tierForPaths(paths) {
  return paths.reduce((max, p) => Math.max(max, tierForPath(p).tier), 0);
}

function commitDistribution(limit) {
  const shas = execSync(`git log -n ${limit} --format=%H`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);

  const dist = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const unmatchedPaths = new Map();
  const examples = { 0: [], 1: [], 2: [], 3: [] };

  for (const sha of shas) {
    let files = [];
    try {
      files = execSync(`git show --pretty=format: --name-only ${sha}`, { encoding: 'utf8' })
        .split('\n').map((s) => s.trim()).filter(Boolean);
    } catch { continue; }
    if (files.length === 0) continue;

    for (const f of files) {
      const { rule } = tierForPath(f);
      if (rule.startsWith('(unmatched')) {
        unmatchedPaths.set(f, (unmatchedPaths.get(f) ?? 0) + 1);
      }
    }

    const tier = tierForPaths(files);
    dist[tier]++;
    if (examples[tier].length < 3) {
      const subject = execSync(`git log -1 --format=%s ${sha}`, { encoding: 'utf8' }).trim();
      examples[tier].push(`${sha.slice(0, 8)}  ${subject.slice(0, 60)}`);
    }
  }

  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const pct = (n) => (total ? ((n / total) * 100).toFixed(1) : '0.0');

  console.log(`\nTier distribution over last ${total} commits with file changes\n`);
  for (const t of [0, 1, 2, 3]) {
    const bar = '█'.repeat(Math.round((dist[t] / Math.max(total, 1)) * 40));
    console.log(`  tier ${t}  ${String(dist[t]).padStart(4)}  ${pct(dist[t]).padStart(5)}%  ${bar}`);
  }

  const autonomous = dist[0] + dist[1];
  console.log(`\n  autonomous-capable (tier 0-1): ${pct(autonomous)}%`);
  console.log(`  needs human review (tier 2-3): ${pct(dist[2] + dist[3])}%`);

  for (const t of [0, 1, 2, 3]) {
    if (examples[t].length) console.log(`\n  tier ${t} examples:\n    ${examples[t].join('\n    ')}`);
  }

  if (unmatchedPaths.size) {
    const top = [...unmatchedPaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`\n  ${unmatchedPaths.size} distinct paths matched NO rule (counted as tier 3).`);
    console.log('  Most frequent — add rules for these to sharpen the map:');
    for (const [p, n] of top) console.log(`    ${String(n).padStart(4)}x  ${p}`);
  }
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--commits') return commitDistribution(Number(args[1] ?? 200));
  if (args[0] === '--explain') {
    const { tier, rule } = tierForPath(args[1]);
    console.log(`${args[1]}\n  tier ${tier}  via  ${rule}`);
    return;
  }
  const paths = args[0] === '--stdin'
    ? readFileSync(0, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    : args;
  if (paths.length === 0) {
    console.error('usage: derive-tier.mjs <path>... | --stdin | --commits [N] | --explain <path>');
    process.exit(2);
  }
  console.log(tierForPaths(paths));
}

if (process.argv[1] && process.argv[1].endsWith('derive-tier.mjs')) main();
