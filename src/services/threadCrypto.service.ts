// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Per-thread message encryption via IC vetKD (audit issue #20 Part B).
 *
 * Each thread has a symmetric key derived on the vetKD subnet from
 * (message_manager canister, "propxchain_msg_v1", threadId). The canister
 * releases the key — encrypted under a per-session transport key — only to
 * thread participants, so subnet node operators see ciphertext only.
 * Architecture + locked invariants: monorepo docs/adr/0011-vetkd-thread-encryption.md
 */

import {
  TransportSecretKey,
  DerivedPublicKey,
  EncryptedVetKey,
  DerivedKeyMaterial,
} from '@dfinity/vetkeys';
import { logger } from '@/utils/logger';

/** Marks ciphertext in the canister's `content: Text` field. */
export const ENCRYPTED_CONTENT_PREFIX = 'vetkd:v1:';

/** Shown when a message can't be decrypted (wrong key, corrupt payload). */
export const ENCRYPTED_PLACEHOLDER = '🔒 Encrypted message';

// HKDF domain separator for message content. IMMUTABLE once ciphertext
// exists — changing it orphans every encrypted message (ADR 0011).
const CONTENT_DOMAIN_SEP = 'propxchain-msg-content-v1';

export type ThreadKeyFetcher = (
  threadId: string,
  transportPublicKey: Uint8Array
) => Promise<Uint8Array>;

export type VerificationKeyFetcher = () => Promise<Uint8Array>;

export function isEncryptedContent(content: string): boolean {
  return content.startsWith(ENCRYPTED_CONTENT_PREFIX);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  // Chunked to stay under argument-count limits for large messages
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt plaintext with already-derived key material.
 * Exported separately from the service so the codec is unit-testable
 * without a network-derived vetKey (DerivedKeyMaterial.setup in tests).
 */
export async function encryptWithMaterial(
  material: DerivedKeyMaterial,
  plaintext: string
): Promise<string> {
  const payload = await material.encryptMessage(plaintext, CONTENT_DOMAIN_SEP);
  return ENCRYPTED_CONTENT_PREFIX + bytesToBase64(payload);
}

/**
 * Decrypt `vetkd:v1:` content with already-derived key material.
 * Returns plaintext content unchanged (legacy pre-encryption rows).
 */
export async function decryptWithMaterial(
  material: DerivedKeyMaterial,
  content: string
): Promise<string> {
  if (!isEncryptedContent(content)) {
    return content;
  }
  const payload = base64ToBytes(content.slice(ENCRYPTED_CONTENT_PREFIX.length));
  const plainBytes = await material.decryptMessage(payload, CONTENT_DOMAIN_SEP);
  return new TextDecoder().decode(plainBytes);
}

export class ThreadCryptoService {
  // Fresh per session (never persisted, never reused across sessions)
  private transportSecretKey: TransportSecretKey | null = null;
  private verificationKey: DerivedPublicKey | null = null;
  private verificationKeyPromise: Promise<DerivedPublicKey> | null = null;
  // One derive per thread per session — each costs the canister ~26B cycles
  private keyCache = new Map<string, DerivedKeyMaterial>();
  private pendingDerives = new Map<string, Promise<DerivedKeyMaterial>>();

  constructor(
    private readonly fetchThreadKey: ThreadKeyFetcher,
    private readonly fetchVerificationKey: VerificationKeyFetcher
  ) {}

  /** Drop all session key state. Call on login/logout/identity change. */
  reset(): void {
    this.transportSecretKey = null;
    this.verificationKey = null;
    this.verificationKeyPromise = null;
    this.keyCache.clear();
    this.pendingDerives.clear();
  }

  async encryptContent(threadId: string, plaintext: string): Promise<string> {
    const material = await this.getThreadKeyMaterial(threadId);
    return encryptWithMaterial(material, plaintext);
  }

  /**
   * Decrypt message content for a thread the caller participates in.
   * Plaintext (legacy) content passes through; undecryptable ciphertext
   * degrades to a placeholder rather than throwing, so one bad message
   * can't break a whole thread render.
   */
  async decryptContent(threadId: string, content: string): Promise<string> {
    if (!isEncryptedContent(content)) {
      return content;
    }
    try {
      const material = await this.getThreadKeyMaterial(threadId);
      return await decryptWithMaterial(material, content);
    } catch (error) {
      logger.warn(`Failed to decrypt message in thread ${threadId}:`, error);
      return ENCRYPTED_PLACEHOLDER;
    }
  }

  private getTransportKey(): TransportSecretKey {
    if (!this.transportSecretKey) {
      this.transportSecretKey = TransportSecretKey.random();
    }
    return this.transportSecretKey;
  }

  private async getVerificationKey(): Promise<DerivedPublicKey> {
    if (this.verificationKey) {
      return this.verificationKey;
    }
    if (!this.verificationKeyPromise) {
      this.verificationKeyPromise = this.fetchVerificationKey()
        .then((bytes) => {
          this.verificationKey = DerivedPublicKey.deserialize(bytes);
          return this.verificationKey;
        })
        .catch((error) => {
          this.verificationKeyPromise = null;
          throw error;
        });
    }
    return this.verificationKeyPromise;
  }

  private async getThreadKeyMaterial(threadId: string): Promise<DerivedKeyMaterial> {
    const cached = this.keyCache.get(threadId);
    if (cached) {
      return cached;
    }
    const pending = this.pendingDerives.get(threadId);
    if (pending) {
      return pending;
    }
    const derivePromise = this.deriveThreadKey(threadId);
    this.pendingDerives.set(threadId, derivePromise);
    try {
      const material = await derivePromise;
      this.keyCache.set(threadId, material);
      return material;
    } finally {
      this.pendingDerives.delete(threadId);
    }
  }

  private async deriveThreadKey(threadId: string): Promise<DerivedKeyMaterial> {
    const tsk = this.getTransportKey();
    const [verificationKey, encryptedKeyBytes] = await Promise.all([
      this.getVerificationKey(),
      this.fetchThreadKey(threadId, tsk.publicKeyBytes()),
    ]);
    const encryptedVetKey = EncryptedVetKey.deserialize(encryptedKeyBytes);
    // decryptAndVerify checks the key against the canister's verification
    // key — a tampered/forged response fails here rather than yielding a
    // silently-wrong AES key.
    const vetKey = encryptedVetKey.decryptAndVerify(
      tsk,
      verificationKey,
      new TextEncoder().encode(threadId)
    );
    return vetKey.asDerivedKeyMaterial();
  }
}
