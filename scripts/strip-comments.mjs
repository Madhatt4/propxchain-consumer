#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { commentRanges } from './check-comments.mjs';

function widen(text, { pos, end, jsxWrapper }) {
  const start = jsxWrapper ? jsxWrapper.start : pos;
  const stop = jsxWrapper ? jsxWrapper.end : end;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = text.indexOf('\n', stop);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const isOwnLine = /^\s*$/.test(text.slice(lineStart, start)) && /^\s*$/.test(text.slice(stop, lineEnd));
  if (isOwnLine) return { start: lineStart, stop: lineEndIdx === -1 ? lineEnd : lineEnd + 1 };
  const lead = text.slice(lineStart, start).match(/[ \t]*$/)[0].length;
  return { start: start - lead, stop };
}

export function stripComments(text, fileName, ts) {
  const ranges = commentRanges(text, fileName, ts).map((r) => widen(text, r));
  let out = text;
  for (const { start, stop } of ranges.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, start) + out.slice(stop);
  }
  return out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

function main() {
  const ts = createRequire(pathToFileURL(`${process.cwd()}/`))('typescript');
  const files = process.argv.slice(2);
  if (files.length === 0) {
    process.stderr.write('Usage: node scripts/strip-comments.mjs <file>...\n');
    process.exit(1);
  }
  for (const f of files) {
    const before = readFileSync(f, 'utf8');
    const after = stripComments(before, f, ts);
    if (after !== before) {
      writeFileSync(f, after);
      const lines = before.split('\n').length - after.split('\n').length;
      process.stdout.write(`${f}: -${lines} lines\n`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
