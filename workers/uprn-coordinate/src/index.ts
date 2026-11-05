// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * GET /uprn-coordinate?uprn=… -> { uprn, latitude, longitude, easting, northing, source }
 *
 * Gives the free property check its exact pin. It replaces a Render service
 * that held the same OS Open UPRN data in SQLite on a paid disk. Here the data
 * ships as the Worker's own static files, which Cloudflare stores and serves
 * at no cost, so nothing has to stay running and nothing is billed per month.
 *
 * Open to any origin: the data is OS OpenData and the endpoint is read-only.
 * Contains OS data © Crown copyright and database right.
 */

import { findCoordinate, isUprn, shardKey } from './lookup';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
}

async function readShard(env: Env, key: string): Promise<string | null> {
  // The host is never contacted: the binding resolves the path inside the Worker's own files.
  const res = await env.ASSETS.fetch(new Request(`https://assets.invalid/s/${key}.bin`));
  if (!res.ok || !res.body) return null;
  return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
}

async function lookup(env: Env, uprn: string): Promise<Response> {
  if (!isUprn(uprn)) return json({ error: 'uprn must be 1 to 12 digits' }, 400);
  const shard = await readShard(env, shardKey(uprn));
  // Every one of the 10,000 shards is built, so a missing one is a broken deploy.
  if (shard === null) return json({ error: 'Lookup unavailable' }, 503);
  const hit = findCoordinate(shard, uprn);
  if (!hit) return json({ error: 'UPRN not found' }, 404, 'public, max-age=86400');
  // A UPRN's position only changes when OS re-surveys it; a month is safe.
  return json({ ...hit, source: 'os-open-uprn' }, 200, 'public, max-age=2592000');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true }, 200);
    if (url.pathname === '/uprn-coordinate') return lookup(env, (url.searchParams.get('uprn') ?? '').trim());
    return json({ error: 'Not found' }, 404);
  },
};
