// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { findCoordinate, isUprn, shardKey } from './lookup';

const SHARD = [
  '100080078720,518412.00,249310.00,52.1301234,-0.2912345',
  '10010338447,429876.50,358123.25,53.1219876,-1.5601234',
  '20338447,1.00,2.00,3.0000000,4.0000000',
].join('\n');

describe('shardKey', () => {
  it('should use the last four digits of the UPRN', () => {
    expect(shardKey('10010338447')).toBe('8447');
  });

  it('should zero-pad a UPRN shorter than four digits', () => {
    expect(shardKey('7')).toBe('0007');
  });
});

describe('isUprn', () => {
  it('should accept 1 to 12 digits and nothing else', () => {
    expect(isUprn('1')).toBe(true);
    expect(isUprn('100080078720')).toBe(true);
    expect(isUprn('1000800787201')).toBe(false);
    expect(isUprn('12a')).toBe(false);
    expect(isUprn('')).toBe(false);
  });
});

describe('findCoordinate', () => {
  it('should return the row for a UPRN in the middle of the shard', () => {
    expect(findCoordinate(SHARD, '10010338447')).toEqual({
      uprn: '10010338447',
      easting: 429876.5,
      northing: 358123.25,
      latitude: 53.1219876,
      longitude: -1.5601234,
    });
  });

  it('should find the first row of the shard', () => {
    expect(findCoordinate(SHARD, '100080078720')?.latitude).toBe(52.1301234);
  });

  it('should not match a UPRN that only ends with the one asked for', () => {
    expect(findCoordinate(SHARD, '338447')).toBeNull();
  });

  it('should not match a longer UPRN that starts with the one asked for', () => {
    expect(findCoordinate(SHARD, '1001033844')).toBeNull();
  });

  it('should read the last row even with a trailing newline or CRLF', () => {
    expect(findCoordinate(`${SHARD.replace(/\n/g, '\r\n')}\r\n`, '20338447')?.longitude).toBe(4);
  });

  it('should return null for a malformed row rather than a bad pin', () => {
    expect(findCoordinate('5,1,2,not-a-number,4', '5')).toBeNull();
  });
});
