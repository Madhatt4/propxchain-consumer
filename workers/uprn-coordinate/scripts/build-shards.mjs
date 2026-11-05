// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Split the OS Open UPRN CSV into the Worker's 10,000 gzip shard files.
 *
 * Usage (from workers/uprn-coordinate):
 *   curl -L -o osuprn.zip "https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect"
 *   unzip -p osuprn.zip 'osopenuprn_*.csv' | node scripts/build-shards.mjs shards
 *   npx wrangler deploy
 *
 * OS republishes the file quarterly; re-run all three steps to refresh.
 *
 * Two passes keep memory small: rows are first spread over 100 temporary files
 * by their last two digits, then each temporary file (about 1% of the data) is
 * split in memory by the last four digits and gzipped. Every one of the 10,000
 * shards is written, even if empty, so the Worker can treat a missing file as
 * a broken deploy rather than "UPRN not found".
 */

import { createReadStream, createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: unzip -p osuprn.zip "osopenuprn_*.csv" | node scripts/build-shards.mjs <outDir>');
  process.exit(1);
}

const shardDir = join(outDir, 's');
const tmpDir = join(outDir, 'tmp');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(shardDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const pad = (n, width) => String(n).padStart(width, '0');

async function spread() {
  const buckets = Array.from({ length: 100 }, (_, i) => createWriteStream(join(tmpDir, `${pad(i, 2)}.csv`)));
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let rows = 0;
  for await (const raw of lines) {
    const line = raw.trim();
    // The header (with its byte-order mark) and anything that is not a data row.
    if (!/^\d{1,12},/.test(line)) continue;
    const uprn = line.slice(0, line.indexOf(','));
    const bucket = buckets[Number(uprn.padStart(2, '0').slice(-2))];
    if (!bucket.write(`${line}\n`)) await new Promise((resolve) => bucket.once('drain', resolve));
    rows += 1;
    if (rows % 5_000_000 === 0) console.log(`  read ${rows.toLocaleString()} rows`);
  }
  await Promise.all(buckets.map((b) => new Promise((resolve) => b.end(resolve))));
  return rows;
}

function split(bucket) {
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

const total = await spread();
for (let bucket = 0; bucket < 100; bucket += 1) split(bucket);
rmSync(tmpDir, { recursive: true, force: true });
console.log(`Done: ${total.toLocaleString()} UPRNs -> 10,000 shards in ${shardDir}`);
