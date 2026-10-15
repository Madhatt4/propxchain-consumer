// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { sha256HexOfText } from '../fileHash';

describe('sha256HexOfText', () => {
  it('should return the known SHA-256 hex digest of a string', async () => {
    // Arrange
    const input = 'test';

    // Act
    const digest = await sha256HexOfText(input);

    // Assert
    expect(digest).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    );
  });

  it('should hash the empty string to the SHA-256 empty digest', async () => {
    const digest = await sha256HexOfText('');

    expect(digest).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('should encode non-ASCII text as UTF-8 before hashing', async () => {
    // "£" is two bytes in UTF-8 (c2 a3); a Latin-1 encoding would differ.
    const digest = await sha256HexOfText('£');

    expect(digest).toBe(
      'b4fe151e413445357b1c0935e7cf04a429492ebd23dc62bfadb2f898c431c1fd'
    );
  });
});
