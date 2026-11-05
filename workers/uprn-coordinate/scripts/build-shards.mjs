// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Split the OS Open UPRN CSV into the Worker's 10,000 gzip shard files.
 *
 * Normally run for you by `pnpm uprn:refresh` (scripts/refresh.mjs). By hand:
 *   unzip -p osuprn.zip 'osopenuprn_*.csv' | node scripts/build-shards.mjs shards
 *
 * Two passes keep memory small: rows are first spread over 100 temporary files
 * by their last two digits, then each temporary file (about 1% of the data) is
 * split in memory by the last four digits and gzipped. Every one of the 10,000
 * shards is written, even if empty, so the Worker can treat a missing file as
 * a broken deploy rather than "UPRN not found".
 */

import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const pad = (n, width) => String(n).padStart(width, '0');

async function spread(input, tmpDir) {
  const buckets = Array.from({ length: 100 }, (_, i) => createWriteStream(join(tmpDir, `${pad(i, 2)}.csv`)));
  const lines = createInterface({ input, crlfDelay: Infinity });
  let rows = 0;
  let sample = null;
  for await (const raw of lines) {
    const line = raw.trim();
    // The header (with its byte-order mark) and anything that is not a data row.
    if (!/^\d{1,12},/.test(line)) continue;
    const uprn = line.slice(0, line.indexOf(','));
    if (!sample) sample = line;
    const bucket = buckets[Number(uprn.padStart(2, '0').slice(-2))];
    if (!bucket.write(`${line}\n`)) await new Promise((done) => bucket.once('drain', done));
    rows += 1;
    if (rows % 5_000_000 === 0) console.log(`  read ${rows.toLocaleString()} rows`);
  }
  await Promise.all(buckets.map((b) => new Promise((done) => b.end(done))));
  return { rows, sample };
}

function split(bucket, tmpDir, shardDir) {
  const text = readFileSync(join(tmpDir, `${pad(bucket, 2)}.csv`), 'utf8');
  const groups = Array.from({ length: 100 }, () => []);
  for (const line of text.split('\n')) {
    if (!line) continue;
    const uprn = line.slice(0, line.indexOf(','));
    groups[Number(uprn.padStart(4, '0').slice(-4, -2))].push(line);
  }
  groups.forEach((rows, hundreds) => {
    const key = `${pad(hundreds, 2)}${pad(bucket, 2)}`;
    writeFileSync(join(shardDir, `${key}.bin`), gzipSync(rows.join('\n'), { level: 9 }));
  });
}

/**
 * Build the shards from a stream of the CSV. Returns the row count and the
 * first data row, which the refresh script uses to check the live Worker.
 */
export async function buildShards(input, outDir) {
  const shardDir = join(outDir, 's');
  const tmpDir = join(outDir, 'tmp');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(shardDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  const { rows, sample } = await spread(input, tmpDir);
  for (let bucket = 0; bucket < 100; bucket += 1) split(bucket, tmpDir, shardDir);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log(`Built ${rows.toLocaleString()} UPRNs into 10,000 shards in ${shardDir}`);
  return { rows, sample };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('usage: unzip -p osuprn.zip "osopenuprn_*.csv" | node scripts/build-shards.mjs <outDir>');
    process.exit(1);
  }
  await buildShards(process.stdin, outDir);
}
