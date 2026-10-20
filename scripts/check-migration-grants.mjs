#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
/**
 * Guard: a migration that creates a public table grants on it explicitly.
 *
 * WHY THIS EXISTS
 * ---------------
 * From 30 Oct 2026 Supabase stops automatically granting Data API access to
 * new tables in the public schema. That covers every rebuild from these
 * migrations too: new projects, preview branches and `supabase db reset`.
 * A table created without a grant would come up unreachable, even by
 * service_role, so each migration must grant in the same file that creates
 * the table. Our posture is stricter than Supabase's example: anon gets
 * access only where it is intentionally public, and says why.
 *
 * WHAT IT CHECKS
 * --------------
 * In each given (or changed) migration file:
 *   1. every `create table` in the public schema (unqualified counts as
 *      public; temp tables are skipped) has a `grant ... on [table]
 *      public.<name> to ... service_role` in the same file;
 *   2. every table grant to `anon` has a SQL comment containing `anon:` and
 *      a reason, on the grant's own lines or the line before it.
 * Comments, string literals and dollar-quoted bodies are ignored, so a
 * function body that mentions `create table` does not count.
 *
 * USAGE
 *   node scripts/check-migration-grants.mjs --base <git-ref>   changed files vs ref
 *   node scripts/check-migration-grants.mjs <file.sql>...      the given files
 *   node scripts/check-migration-grants.mjs --self-test        run the fixtures
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_GLOB = 'supabase/migrations/*.sql';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'migration-grants');
const IDENT = '(?:"[^"]+"|[a-z_][a-z0-9_$]*)';
const QUALIFIED = `${IDENT}(?:\\s*\\.\\s*${IDENT})?`;
const CREATE_TABLE = new RegExp(
  `^create\\s+(?:(?:global|local)\\s+)?(temp|temporary\\s+)?(?:unlogged\\s+)?table\\s+` +
    `(?:if\\s+not\\s+exists\\s+)?(${QUALIFIED})`,
);
const GRANT = /^grant\s+.+?\s+on\s+(.+?)\s+to\s+(.+?)(?:\s+with\s+grant\s+option)?$/;
const NON_TABLE_OBJECT =
  /^(?:function|procedure|routine|schema|sequence|all|database|type|domain|foreign|large|language|tablespace)\b/;
const ANON_REASON = /anon:\s*\S/;

/**
 * If a comment, string literal or dollar-quoted body starts at `i`, return
 * where it ends and whether it is a comment; otherwise null.
 */
function skippable(sql, i) {
  const rest = sql.slice(i, i + 2);
  if (rest === '--') {
    const nl = sql.indexOf('\n', i);
    return { end: nl === -1 ? sql.length : nl, isComment: true };
  }
  if (rest === '/*') {
    const close = sql.indexOf('*/', i + 2);
    return { end: close === -1 ? sql.length : close + 2, isComment: true };
  }
  if (sql[i] === "'") {
    let end = i + 1;
    // '' inside a literal is an escaped quote, not the end.
    while (end < sql.length && !(sql[end] === "'" && sql[end + 1] !== "'")) end += sql[end] === "'" ? 2 : 1;
    return { end: Math.min(end + 1, sql.length), isComment: false };
  }
  const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64));
  if (dollar && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? '')) {
    const close = sql.indexOf(dollar[0], i + dollar[0].length);
    return { end: close === -1 ? sql.length : close + dollar[0].length, isComment: false };
  }
  return null;
}

/** Blank out comments, string literals and dollar-quoted bodies, keeping newlines. */
function scan(sql) {
  const code = [];
  const comments = new Map();
  let line = 1;
  let i = 0;
  while (i < sql.length) {
    const skip = skippable(sql, i);
    if (!skip) {
      code.push(sql[i]);
      if (sql[i] === '\n') line += 1;
      i += 1;
      continue;
    }
    for (let k = i; k < skip.end; k += 1) {
      if (skip.isComment && sql[k] !== '\n') comments.set(line, `${comments.get(line) ?? ''}${sql[k]}`);
      code.push(sql[k] === '\n' ? '\n' : ' ');
      if (sql[k] === '\n') line += 1;
    }
    i = skip.end;
  }
  return { code: code.join(''), comments };
}

/** Split blanked code on `;` into statements with their first and last line. */
function statements(code) {
  const out = [];
  let line = 1;
  let start = null;
  let text = '';
  for (const ch of code) {
    if (ch === ';') {
      if (start !== null) out.push({ text: text.trim(), startLine: start, endLine: line });
      start = null;
      text = '';
      continue;
    }
    if (start === null && /\S/.test(ch)) start = line;
    if (start !== null) text += ch;
    if (ch === '\n') line += 1;
  }
  if (start !== null && text.trim()) out.push({ text: text.trim(), startLine: start, endLine: line });
  return out;
}

/** `"Public" . "Foo"` -> `public.foo`; an unqualified name is public. */
function normaliseName(raw) {
  const parts = raw.split('.').map((p) => p.trim().replace(/^"|"$/g, '').toLowerCase());
  return parts.length === 1 ? `public.${parts[0]}` : `${parts[0]}.${parts[1]}`;
}

function parseGrant(text) {
  const match = GRANT.exec(text);
  if (!match) return null;
  const objects = match[1].replace(/^table\s+/, '');
  if (NON_TABLE_OBJECT.test(objects)) return null;
  return {
    tables: objects.split(',').map((o) => normaliseName(o)),
    roles: match[2].split(',').map((r) => r.trim().replace(/^"|"$/g, '')),
  };
}

function hasAnonReason(comments, stmt) {
  for (let l = stmt.startLine - 1; l <= stmt.endLine; l += 1) {
    if (ANON_REASON.test(comments.get(l) ?? '')) return true;
  }
  return false;
}

/** Returns a list of human-readable violations for one migration's SQL. */
export function checkSql(sql) {
  const { code, comments } = scan(sql);
  const created = new Map();
  const serviceGranted = new Set();
  const problems = [];
  for (const stmt of statements(code)) {
    const lower = stmt.text.toLowerCase().replace(/\s+/g, ' ');
    const create = CREATE_TABLE.exec(lower);
    if (create && !create[1]) {
      const name = normaliseName(create[2]);
      if (name.startsWith('public.') && !created.has(name)) created.set(name, stmt.startLine);
      continue;
    }
    const grant = parseGrant(lower);
    if (!grant) continue;
    for (const table of grant.tables) {
      if (grant.roles.includes('service_role')) serviceGranted.add(table);
      if (grant.roles.includes('anon') && !hasAnonReason(comments, stmt)) {
        problems.push(
          `line ${stmt.startLine}: grant on ${table} to anon needs a comment "-- anon: <reason>" on the line before or the same line`,
        );
      }
    }
  }
  for (const [table, line] of created) {
    if (!serviceGranted.has(table)) {
      problems.push(`line ${line}: create table ${table} has no "grant ... on ${table} to service_role" in this file`);
    }
  }
  return problems;
}

function changedMigrations(base) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', base, 'HEAD', '--', MIGRATIONS_GLOB],
    { encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean);
}

function checkFiles(files) {
  let failed = 0;
  for (const file of files) {
    const problems = checkSql(readFileSync(file, 'utf8'));
    if (problems.length === 0) {
      console.log(`ok    ${file}`);
      continue;
    }
    failed += 1;
    for (const p of problems) console.log(`FAIL  ${file} ${p}`);
  }
  return failed;
}

function selfTest() {
  let wrong = 0;
  for (const kind of ['good', 'bad']) {
    const dir = join(FIXTURES, kind);
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      const problems = checkSql(readFileSync(join(dir, name), 'utf8'));
      const passed = problems.length === 0;
      const right = kind === 'good' ? passed : !passed;
      if (!right) wrong += 1;
      console.log(`${right ? 'ok  ' : 'BAD '}  ${kind}/${name}${problems.length ? ` -> ${problems.join('; ')}` : ''}`);
    }
  }
  return wrong;
}

function main(args) {
  if (args[0] === '--self-test') {
    const wrong = selfTest();
    if (wrong) console.error(`migration grants self-test: ${wrong} fixture(s) gave the wrong verdict`);
    return wrong ? 1 : 0;
  }
  const files = args[0] === '--base' ? changedMigrations(args[1]) : args;
  if (files.length === 0) {
    console.log('migration grants: no added or modified migrations to check');
    return 0;
  }
  const failed = checkFiles(files);
  if (failed) {
    console.error(
      `migration grants: ${failed} file(s) failed. Since 30 Oct 2026 Supabase no longer grants new public ` +
        'tables automatically: grant service_role (and authenticated if the app uses it) in the same ' +
        'migration, and give every anon grant an "-- anon: <reason>" comment.',
    );
  }
  return failed ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
