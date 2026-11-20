#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const BASELINE_PATH = 'scripts/comment-baseline.json';
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|mo)$/;
const GENERATED = [
  /(^|\/)(node_modules|dist|build|\.dfx|declarations)\//,
  /\.did\.(js|d\.ts)$/,
  /\.d\.ts$/,
];

const DIRECTIVE = new RegExp(
  [
    '^SPDX-License-Identifier:',
    '^Copyright \\(C\\)',
    '^Proprietary and confidential\\.?$',
    '^(async-safety|tx-lock|rate-limit)-check:',
    '^eslint(-disable|-enable)?\\b',
    '^@ts-(expect-error|ignore|nocheck|check)\\b',
    '^prettier-ignore\\b',
    '^(istanbul|c8|v8) ignore\\b',
    '^@vite-ignore\\b',
    '^[#@]__(PURE|NO_SIDE_EFFECTS)__',
    '^<reference ',
    '^@jsx(ImportSource|Runtime|Frag)?\\b',
    '^@vitest-environment\\b',
    '^@refresh reset\\b',
    '^deno-(lint|fmt)-ignore',
    '^@type(def)? \\{',
    '^global ',
    '^webpack[A-Z]',
  ].join('|'),
);

function commentBody(raw) {
  return raw
    .replace(/^\/\/\/?\s*/, '')
    .replace(/^\/\*\*?\s*/, '')
    .replace(/\*\/$/, '')
    .trim();
}

export function isDirective(raw) {
  return DIRECTIVE.test(commentBody(raw));
}

export function tsCommentRanges(text, fileName, ts) {
  const kind = /\.(tsx|jsx)$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const seen = new Map();
  const collect = (ranges) => {
    for (const r of ranges ?? []) {
      if (!seen.has(r.pos)) seen.set(r.pos, { pos: r.pos, end: r.end, raw: text.slice(r.pos, r.end) });
    }
  };
  const visit = (node) => {
    if (node.kind !== ts.SyntaxKind.JsxText) {
      collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
      collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    }
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);
  return [...seen.values()].sort((a, b) => a.pos - b.pos);
}

export function motokoCommentRanges(text) {
  const out = [];
  const push = (pos, end) => out.push({ pos, end, raw: text.slice(pos, end) });
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i++;
    } else if (text[i] === "'" && /^'(\\.[^']*|[^\\'])'/.test(text.slice(i, i + 12))) {
      i = text.indexOf("'", i + 2) + 1;
    } else if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      push(i, stop);
      i = stop;
    } else if (text.startsWith('/*', i)) {
      const start = i;
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        if (text.startsWith('/*', i)) {
          depth++;
          i += 2;
        } else if (text.startsWith('*/', i)) {
          depth--;
          i += 2;
        } else i++;
      }
      push(start, i);
    } else i++;
  }
  return out;
}

export function commentRanges(text, fileName, ts) {
  const all = fileName.endsWith('.mo') ? motokoCommentRanges(text) : tsCommentRanges(text, fileName, ts);
  return all.filter((c) => !isDirective(c.raw));
}

export function countComments(text, fileName, ts) {
  return commentRanges(text, fileName, ts).length;
}

export function compare(baseline, current) {
  const grew = [];
  const shrank = [];
  for (const [file, n] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (n > allowed) grew.push({ file, allowed, n });
    if (n < allowed) shrank.push({ file, allowed, n });
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    if (!(file in current)) shrank.push({ file, allowed, n: 0 });
  }
  const total = (m) => Object.values(m).reduce((s, n) => s + n, 0);
  return { grew, shrank, baselineTotal: total(baseline), currentTotal: total(current) };
}

function scan(ts) {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => SOURCE.test(f) && !GENERATED.some((g) => g.test(f)));
  const counts = {};
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const n = countComments(text, f, ts);
    if (n > 0) counts[f] = n;
  }
  return counts;
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function writeBaseline(counts) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

function main() {
  const ts = createRequire(pathToFileURL(`${process.cwd()}/`))('typescript');
  const isUpdate = process.argv.includes('--update');
  const isInit = process.argv.includes('--init');
  const stored = readBaseline();
  const current = scan(ts);

  if (isInit) {
    if (stored) {
      process.stderr.write(`${BASELINE_PATH} already exists; use --update, which can only lower it.\n`);
      process.exit(1);
    }
    writeBaseline(current);
    process.stdout.write(`Comment baseline created: ${Object.values(current).reduce((s, n) => s + n, 0)} comments.\n`);
    return;
  }
  if (!stored) {
    process.stderr.write(`${BASELINE_PATH} is missing. Create it once with --init.\n`);
    process.exit(1);
  }

  const baseline = stored;
  const { grew, shrank, baselineTotal, currentTotal } = compare(baseline, current);

  if (isUpdate) {
    if (currentTotal > baselineTotal) {
      process.stderr.write(
        `Refusing to raise the comment baseline: ${currentTotal} comments now, ${baselineTotal} allowed.\n` +
          'Delete comments rather than adding them; the reason belongs in an ADR, a test name or a clearer identifier.\n',
      );
      process.exit(1);
    }
    writeBaseline(current);
    process.stdout.write(`Comment baseline written: ${currentTotal} comments (was ${baselineTotal}).\n`);
    return;
  }

  if (grew.length > 0) {
    process.stderr.write('New code comments are not allowed (comment ratchet):\n');
    for (const g of grew) process.stderr.write(`  ${g.file}: ${g.n} comments, baseline allows ${g.allowed}\n`);
    process.stderr.write(
      '\nRemove them. A decision worth keeping goes in docs/adr/; anything else should be said by the code.\n' +
        'Tool directives (eslint-disable, @ts-expect-error, SPDX headers) are exempt.\n' +
        'Moved a file? Run `node scripts/check-comments.mjs --update` (it refuses if the total grows).\n',
    );
    process.exit(1);
  }
  if (shrank.length > 0) {
    process.stderr.write(
      `Comments were removed (${baselineTotal} -> ${currentTotal}), so tighten the ratchet:\n` +
        '  node scripts/check-comments.mjs --update\nand commit scripts/comment-baseline.json.\n',
    );
    process.exit(1);
  }
  process.stdout.write(`Comment ratchet OK: ${currentTotal} comments left to remove.\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
