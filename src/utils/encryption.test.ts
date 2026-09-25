// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, generateEncryptionKey } from './encryption';

describe('Web Crypto Encryption', () => {
  it('encrypts and decrypts data successfully', async () => {
    const key = await generateEncryptionKey();
    const plaintext = new TextEncoder().encode('sensitive data').buffer;

    const encrypted = await encryptData(plaintext, key);
    const decrypted = await decryptData(encrypted, key);

    const decryptedText = new TextDecoder().decode(new Uint8Array(decrypted));
    expect(decryptedText).toBe('sensitive data');
  });

  it('prepends IV to ciphertext', async () => {
    const key = await generateEncryptionKey();
    const plaintext = new TextEncoder().encode('test').buffer;

    const encrypted = await encryptData(plaintext, key);
    const ivLength = 12; // AES-GCM IV size

    expect(encrypted.byteLength).toBeGreaterThan(ivLength);
    // First 12 bytes should be IV
    const iv = new Uint8Array(encrypted).slice(0, ivLength);
    expect(iv.length).toBe(ivLength);
  });

  it('fails decryption with wrong key', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const plaintext = new TextEncoder().encode('secret').buffer;

    const encrypted = await encryptData(plaintext, key1);

    await expect(decryptData(encrypted, key2)).rejects.toThrow();
  });
});
