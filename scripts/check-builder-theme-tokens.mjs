#!/usr/bin/env node
/**
 * Guard: the builder portal draws its surfaces from the app theme tokens.
 *
 * WHY THIS EXISTS
 * ---------------
 * The builder pages were written with Tailwind greys (bg-white, text-gray-900,
 * border-gray-200, each with a dark: twin) while the dashboard drew from the
 * variables in Dashboard_Premium.css. Same brand, two palettes, and it took a
 * 31-file sweep (#383) to reconcile them. Nothing stopped the next builder
 * page from starting the drift again, which is what this check is for.
 *
 * WHAT IT CHECKS
 * --------------
 * Under src/pages/builder and src/components/builder, production files may not
 * use `gray-<n>` or `bg-white` utility classes, with or without a variant
 * prefix. Use the tokens instead: --bg-main, --bg-card, --bg-section,
 * --text-main, --text-secondary, --text-muted, --border-color, --border-light.
 *
 * Test files are out of scope: they are not shipped.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/pages/builder', 'src/components/builder'];
const BANNED = /\b(?:[a-z-]+:)*(?:[a-z-]+-)?(?:gray-\d{2,3}(?:\/\d+)?|bg-white)\b/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [full];
  });
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const found = line.match(BANNED);
      if (found) hits.push(`${file}:${i + 1}: ${found.join(' ')}`);
    });
  }
}

if (hits.length > 0) {
  console.error('Builder portal must use theme tokens, not Tailwind greys:\n');
  console.error(hits.join('\n'));
  console.error(`\n${hits.length} hit(s). See scripts/check-builder-theme-tokens.mjs for the token list.`);
  process.exit(1);
}

console.log('builder theme tokens OK');
