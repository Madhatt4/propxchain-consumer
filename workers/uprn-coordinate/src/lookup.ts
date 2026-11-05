// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * UPRN -> exact coordinate, read from OS Open UPRN shard files.
 *
 * OS Open UPRN is free OpenData published only as one bulk CSV (about 41.5
 * million rows), not as an API. The build script splits it into 10,000 small
 * gzip files keyed by the last four digits of the UPRN, which are spread evenly,
 * so each lookup reads one file of about 4,000 rows instead of the whole set.
 * A shard is plain CSV lines: "uprn,easting,northing,latitude,longitude".
 */

export interface UprnCoordinate {
  uprn: string;
  latitude: number;
  longitude: number;
  easting: number;
  northing: number;
}

export const SHARD_DIGITS = 4;

export function isUprn(value: string): boolean {
  return /^\d{1,12}$/.test(value);
}

/** The shard a UPRN lives in: its last four digits, zero-padded. */
export function shardKey(uprn: string): string {
  return uprn.padStart(SHARD_DIGITS, '0').slice(-SHARD_DIGITS);
}

/** Find one UPRN's row in a shard's text, or null when it is not there. */
export function findCoordinate(shard: string, uprn: string): UprnCoordinate | null {
  const prefix = `${uprn},`;
  let start = shard.startsWith(prefix) ? 0 : shard.indexOf(`\n${prefix}`);
  if (start === -1) return null;
  if (start > 0 || shard[0] === '\n') start += 1;
  const end = shard.indexOf('\n', start);
  const line = shard.slice(start, end === -1 ? undefined : end).trim();
  const [, x, y, lat, lon] = line.split(',');
  const values = [x, y, lat, lon].map(Number);
  if (values.some((v) => !Number.isFinite(v))) return null;
  const [easting, northing, latitude, longitude] = values;
  return { uprn, latitude, longitude, easting, northing };
}
