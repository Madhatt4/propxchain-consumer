// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { compare, countComments, isDirective, motokoCommentRanges, updateRefusal } from './check-comments.mjs';
import { stripComments } from './strip-comments.mjs';

const ts = createRequire(import.meta.url)('typescript');

test('should count line, block and trailing comments in TypeScript', () => {
  const src = '// one\nconst a = 1; // two\n/* three */\n/** four */\nexport const b = a;\n';
  assert.equal(countComments(src, 'x.ts', ts), 4);
});

test('should not count slashes inside strings, templates or regex literals', () => {
  const src = "const u = 'http://x';\nconst t = `a // b ${u}`;\nconst r = /\\/\\/ not/;\n";
  assert.equal(countComments(src, 'x.ts', ts), 0);
});

test('should not count a URL in JSX text but should count a JSX comment', () => {
  const src = 'export const A = () => <p>see http://x.test {/* real */}</p>;\n';
  assert.equal(countComments(src, 'x.tsx', ts), 1);
});

test('should exempt tool directives and licence headers', () => {
  const src = [
    '// SPDX-License-Identifier: AGPL-3.0-or-later',
    '// Copyright (C) 2026 PropXchain Ltd',
    '// eslint-disable-next-line no-console',
    '// @ts-expect-error fixture',
    '/* @vite-ignore */',
    'const x = 1;',
  ].join('\n');
  assert.equal(countComments(src, 'x.ts', ts), 0);
});

test('should exempt the CI guard opt-out markers and the private licence header', () => {
  assert.equal(isDirective('// async-safety-check: skip (read-only after await)'), true);
  assert.equal(isDirective('// tx-lock-check: skip (no state read)'), true);
  assert.equal(isDirective('// rate-limit-check: skip (cron only)'), true);
  assert.equal(isDirective('// Proprietary and confidential.'), true);
});

test('should treat prose that mentions a directive as a normal comment', () => {
  assert.equal(isDirective('// we avoid eslint here because'), false);
  assert.equal(isDirective('// eslint-disable-line'), true);
});

test('should handle Motoko strings, char literals and nested block comments', () => {
  const src = 'let s = "// no";\nlet c = \'"\';\n/* outer /* inner */ still */\n// yes\n';
  assert.equal(motokoCommentRanges(src).length, 2);
});

test('should report growth per file and shrinkage including deleted files', () => {
  const result = compare({ 'a.ts': 2, 'gone.ts': 1 }, { 'a.ts': 3, 'new.ts': 1 });
  assert.deepEqual(
    result.grew.map((g) => g.file),
    ['a.ts', 'new.ts'],
  );
  assert.deepEqual(
    result.shrank.map((s) => s.file),
    ['gone.ts'],
  );
  assert.equal(result.baselineTotal, 3);
  assert.equal(result.currentTotal, 4);
});

test('should strip own-line, trailing and JSX comments but keep directives', () => {
  const src = [
    '// SPDX-License-Identifier: AGPL-3.0-or-later',
    '',
    '/** Doc. */',
    'const a = 1; // trailing',
    '// eslint-disable-next-line no-console',
    "const url = 'http://x';",
    'export const A = () => <p>{/* gone */}hi</p>;',
    '',
  ].join('\n');
  const expected = [
    '// SPDX-License-Identifier: AGPL-3.0-or-later',
    '',
    'const a = 1;',
    '// eslint-disable-next-line no-console',
    "const url = 'http://x';",
    'export const A = () => <p>hi</p>;',
    '',
  ].join('\n');
  assert.equal(stripComments(src, 'x.tsx', ts), expected);
});

test('should keep the braces of a block whose only content is a comment', () => {
  assert.equal(stripComments('function f() { /* x */ }\n', 'x.ts', ts), 'function f() { }\n');
  assert.equal(stripComments('const o = {\n  // only\n};\n', 'x.ts', ts), 'const o = {\n};\n');
  assert.equal(stripComments('module {\n  // only\n}\n', 'x.mo', ts), 'module {\n}\n');
});

test('should not desync on a Motoko escaped-quote char literal', () => {
  const src = "let q = '\\'';\nlet s = \"// no\";\n// yes\n";
  assert.equal(motokoCommentRanges(src).length, 1);
});

test('should collapse the blank lines a removed block leaves behind', () => {
  const src = 'const a = 1;\n\n/**\n * Gone.\n */\n\nconst b = 2;\n';
  assert.equal(stripComments(src, 'x.ts', ts), 'const a = 1;\n\nconst b = 2;\n');
});

test('should refuse an update that adds comments to one file while deleting elsewhere', () => {
  const refusal = updateRefusal({ 'a.ts': 1, 'b.ts': 5 }, { 'a.ts': 2, 'b.ts': 0 });
  assert.match(refusal ?? '', /a\.ts/);
});

test('should allow an update for a renamed file that keeps its comments', () => {
  assert.equal(updateRefusal({ 'old.ts': 3, 'b.ts': 2 }, { 'new.ts': 3, 'b.ts': 1 }), null);
});

test('should refuse a new file whose comments exceed what moved files freed', () => {
  assert.match(updateRefusal({ 'old.ts': 1 }, { 'new.ts': 2 }) ?? '', /freed only 1/);
});

test('should return empty lists when nothing changed', () => {
  const result = compare({ 'a.ts': 2 }, { 'a.ts': 2 });
  assert.equal(result.grew.length + result.shrank.length, 0);
});
