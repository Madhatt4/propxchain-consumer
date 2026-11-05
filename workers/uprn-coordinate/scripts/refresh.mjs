// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Quarterly refresh of the exact-pin data, in one command:
 *
 *   pnpm uprn:refresh            (from the repo root)
 *
 * 1. Downloads the latest OS Open UPRN release (about 620 MB) to a temp folder.
 * 2. Builds the 10,000 shard files straight from the zip, no unzipping to disk.
 * 3. Refuses to deploy a set that looks truncated.
 * 4. Deploys the propxchain-uprn Worker with wrangler (you must be logged in).
 * 5. Asks the live Worker for one UPRN and checks it matches the new file.
 * 6. Deletes the download and the built shards.
 *
 * Plain Node, no dependencies, so it runs the same in PowerShell, Git Bash or CI.
 * Set OSUPRN_DIR to download somewhere other than the system temp folder.
 */

import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, mkdirSync, openSync, readSync, closeSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInflateRaw } from 'node:zlib';

import { buildShards } from './build-shards.mjs';

const DOWNLOAD_URL = 'https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect';
const LIVE_URL = 'https://propxchain-uprn.hatton-marc.workers.dev';
// The October 2026 release held 41.5 million rows; far fewer means a bad download.
const MIN_ROWS = 35_000_000;

const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const workDir = process.env.OSUPRN_DIR ?? join(tmpdir(), 'osuprn-refresh');
const zipPath = join(workDir, 'osuprn.zip');
const shardsDir = join(workerDir, 'shards');

function step(message) {
  console.log(`\n== ${message}`);
}

async function download() {
  mkdirSync(workDir, { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(DOWNLOAD_URL, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath));
      console.log(`  ${(statSync(zipPath).size / 1e6).toFixed(0)} MB`);
      return;
    } catch (err) {
      console.log(`  attempt ${attempt} failed: ${err.message}`);
      if (attempt === 3) throw err;
    }
  }
}

function readAt(fd, position, length) {
  const buf = Buffer.alloc(length);
  readSync(fd, buf, 0, length, position);
  return buf;
}

/** Locate the CSV inside the zip from its central directory and stream it inflated. */
export function openCsvFromZip(path) {
  const size = statSync(path).size;
  const fd = openSync(path, 'r');
  try {
    const tail = readAt(fd, Math.max(0, size - 65_557), Math.min(size, 65_557));
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd === -1) throw new Error('not a zip file');
    const entries = tail.readUInt16LE(eocd + 10);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff) throw new Error('zip64 archive: use unzip -p | node scripts/build-shards.mjs shards');
    const cd = readAt(fd, cdOffset, tail.readUInt32LE(eocd + 12));
    let at = 0;
    for (let i = 0; i < entries; i += 1) {
      const method = cd.readUInt16LE(at + 10);
      const compressed = cd.readUInt32LE(at + 20);
      const nameLen = cd.readUInt16LE(at + 28);
      const skip = nameLen + cd.readUInt16LE(at + 30) + cd.readUInt16LE(at + 32);
      const local = cd.readUInt32LE(at + 42);
      const name = cd.toString('utf8', at + 46, at + 46 + nameLen);
      at += 46 + skip;
      if (!/^osopenuprn_.*\.csv$/i.test(name)) continue;
      if (method !== 8 || compressed === 0xffffffff) throw new Error(`unsupported entry ${name}`);
      const header = readAt(fd, local, 30);
      const start = local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
      console.log(`  reading ${name}`);
      return createReadStream(path, { start, end: start + compressed - 1 }).pipe(createInflateRaw());
    }
    throw new Error('no osopenuprn_*.csv in the zip');
  } finally {
    closeSync(fd);
  }
}

function deploy() {
  const run = spawnSync('npx', ['--yes', 'wrangler@4', 'deploy'], { cwd: workerDir, stdio: 'inherit', shell: true });
  if (run.status !== 0) throw new Error('wrangler deploy failed (run `npx wrangler login` and try again)');
}

async function checkLive(sample) {
  const [uprn, , , lat, lon] = sample.split(',');
  const res = await fetch(`${LIVE_URL}/uprn-coordinate?uprn=${uprn}`);
  const body = await res.json();
  if (!res.ok || body.latitude !== Number(lat) || body.longitude !== Number(lon)) {
    throw new Error(`live check failed for UPRN ${uprn}: ${res.status} ${JSON.stringify(body)}`);
  }
  console.log(`  UPRN ${uprn} -> ${body.latitude}, ${body.longitude} (matches the new file)`);
}

export async function main() {
  step('Downloading OS Open UPRN');
  await download();
  step('Building shards');
  const { rows, sample } = await buildShards(openCsvFromZip(zipPath), shardsDir);
  if (rows < MIN_ROWS || !sample) throw new Error(`only ${rows.toLocaleString()} rows; not deploying`);
  step('Deploying propxchain-uprn');
  deploy();
  step('Checking the live Worker');
  await checkLive(sample);
  step('Cleaning up');
  rmSync(workDir, { recursive: true, force: true });
  rmSync(shardsDir, { recursive: true, force: true });
  console.log('Done. The exact-pin data is up to date.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
