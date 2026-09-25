// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Codec tests for vetKD per-thread message encryption (ADR 0011).
 * Key material is constructed locally via DerivedKeyMaterial.setup so the
 * encode/encrypt/decrypt/decode path is tested without a network vetKey;
 * the vetKD derivation itself is covered by the mainnet E2E script
 * (scripts/vetkd-e2e.mjs).
 */

import { describe, it, expect } from 'vitest';
import { DerivedKeyMaterial } from '@dfinity/vetkeys';
import {
  encryptWithMaterial,
  decryptWithMaterial,
  isEncryptedContent,
  ENCRYPTED_CONTENT_PREFIX,
  ENCRYPTED_PLACEHOLDER,
  ThreadCryptoService,
} from '../threadCrypto.service';

const keyBytes = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);

describe('threadCrypto codec', () => {
  it('should round-trip plaintext through encrypt and decrypt', async () => {
    const material = await DerivedKeyMaterial.setup(keyBytes(7));
    const plaintext = 'Privileged solicitor-client content £100,000 — exchange Friday';

    const encrypted = await encryptWithMaterial(material, plaintext);
    const decrypted = await decryptWithMaterial(material, encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should prefix ciphertext with the vetkd:v1 marker and not contain the plaintext', async () => {
    const material = await DerivedKeyMaterial.setup(keyBytes(7));
    const plaintext = 'secret-marker-string';

    const encrypted = await encryptWithMaterial(material, plaintext);

    expect(encrypted.startsWith(ENCRYPTED_CONTENT_PREFIX)).toBe(true);
    expect(encrypted).not.toContain(plaintext);
  });

  it('should produce different ciphertext for the same plaintext on each call', async () => {
    const material = await DerivedKeyMaterial.setup(keyBytes(7));

    const first = await encryptWithMaterial(material, 'same message');
    const second = await encryptWithMaterial(material, 'same message');

    expect(first).not.toBe(second);
  });

  it('should pass legacy plaintext content through decrypt unchanged', async () => {
    const material = await DerivedKeyMaterial.setup(keyBytes(7));
    const legacy = 'pre-encryption plaintext message';

    const result = await decryptWithMaterial(material, legacy);

    expect(result).toBe(legacy);
  });

  it('should fail to decrypt with a different key', async () => {
    const materialA = await DerivedKeyMaterial.setup(keyBytes(1));
    const materialB = await DerivedKeyMaterial.setup(keyBytes(2));

    const encrypted = await encryptWithMaterial(materialA, 'thread A only');

    await expect(decryptWithMaterial(materialB, encrypted)).rejects.toThrow();
  });

  it('should round-trip unicode and multi-line content', async () => {
    const material = await DerivedKeyMaterial.setup(keyBytes(9));
    const plaintext = 'Line one\nLine two — £émoji 🏠\n\tTabs too';

    const decrypted = await decryptWithMaterial(
      material,
      await encryptWithMaterial(material, plaintext)
    );

    expect(decrypted).toBe(plaintext);
  });

  it('should detect encrypted content by prefix only', () => {
    expect(isEncryptedContent(`${ENCRYPTED_CONTENT_PREFIX}abc`)).toBe(true);
    expect(isEncryptedContent('plain message')).toBe(false);
    expect(isEncryptedContent('')).toBe(false);
    expect(isEncryptedContent('vetkd:v2:future')).toBe(false);
  });
});

describe('ThreadCryptoService', () => {
  it('should return placeholder when ciphertext cannot be decrypted', async () => {
    const service = new ThreadCryptoService(
      async () => {
        throw new Error('Not authorized to access this thread');
      },
      async () => {
        throw new Error('unreachable');
      }
    );

    const result = await service.decryptContent(
      'thread_1',
      `${ENCRYPTED_CONTENT_PREFIX}AAAA`
    );

    expect(result).toBe(ENCRYPTED_PLACEHOLDER);
  });

  it('should pass plaintext through without fetching any key', async () => {
    let fetcherCalled = false;
    const service = new ThreadCryptoService(
      async () => {
        fetcherCalled = true;
        return new Uint8Array();
      },
      async () => {
        fetcherCalled = true;
        return new Uint8Array();
      }
    );

    const result = await service.decryptContent('thread_1', 'plain text');

    expect(result).toBe('plain text');
    expect(fetcherCalled).toBe(false);
  });

  it('should only call the thread-key fetcher once for concurrent decrypts of the same thread', async () => {
    let fetchCount = 0;
    // Fetcher returns garbage — both calls fail to a placeholder, but the
    // derive must be deduped to a single canister call (26B cycles each).
    const service = new ThreadCryptoService(
      async () => {
        fetchCount += 1;
        return new Uint8Array(192).fill(3);
      },
      async () => new Uint8Array(96).fill(2)
    );

    const encrypted = `${ENCRYPTED_CONTENT_PREFIX}AAAA`;
    await Promise.all([
      service.decryptContent('thread_1', encrypted),
      service.decryptContent('thread_1', encrypted),
      service.decryptContent('thread_1', encrypted),
    ]);

    expect(fetchCount).toBe(1);
  });
});
