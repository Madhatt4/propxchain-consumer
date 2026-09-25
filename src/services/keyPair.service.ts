import { Ed25519KeyIdentity } from '@propxchain/core-client';
import { keyMaterialService } from './keyMaterial.service';

const V1_SALT = 'propxchain-keypair-v1';
const ALGO = 'AES-GCM';
const IV_BYTES = 12;
const MATERIAL_BYTES = 32;

export type Envelope =
  | { version: 1; iv: Uint8Array; ciphertext: Uint8Array }
  | { version: 2; pepperVersion: number; iv: Uint8Array; ciphertext: Uint8Array };

export class UnsupportedEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedEnvelopeError';
  }
}

function b64ToBytes(input: string): Uint8Array {
  return Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
}

function bytesToB64(input: Uint8Array): string {
  let s = '';
  for (const b of input) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * V1 key derivation — DECRYPT ONLY. Retained solely to read legacy blobs.
 *
 * Both inputs are public (userId is the Supabase UUID; the salt is a constant),
 * so this protects nothing: anyone holding the blob and the userId recomputes
 * the key. The 100k iterations are theatre against a known input. Never emit v1.
 */
async function deriveKeyV1(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId + V1_SALT),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(V1_SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** V2: AES key from server-held-pepper material. `pepperVersion` omitted = fresh encrypt. */
async function deriveKeyV2(
  pepperVersion?: number,
): Promise<{ key: CryptoKey; pepperVersion: number }> {
  const { material, pepperVersion: served } = await keyMaterialService.getMaterial(pepperVersion);
  if (material.length !== MATERIAL_BYTES) {
    throw new Error(`key material is ${material.length} bytes, expected ${MATERIAL_BYTES}`);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(material),
    ALGO,
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, pepperVersion: served };
}

async function encryptWith(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGO, iv }, key, new Uint8Array(plaintext)),
  );
  return { iv, ciphertext };
}

export const KeyPairService = {
  /**
   * Parse a stored blob.
   *
   * Detection is by STRING PREFIX. Never version-detect on a leading magic
   * byte: a v1 blob starts with a random IV byte, so 0x02 would collide
   * 1-in-256. The base64 alphabet excludes '.', so a bare v1 blob never
   * contains one.
   */
  parseEnvelope(blob: string): Envelope {
    if (!blob.includes('.')) {
      const packed = b64ToBytes(blob);
      return { version: 1, iv: packed.slice(0, IV_BYTES), ciphertext: packed.slice(IV_BYTES) };
    }
    const match = /^v(\d+)\.(\d+)\.(.*)$/.exec(blob);
    if (!match) throw new UnsupportedEnvelopeError('unparseable envelope');
    const envelopeVersion = Number(match[1]);
    if (envelopeVersion !== 2) {
      throw new UnsupportedEnvelopeError(`unsupported envelope version ${envelopeVersion}`);
    }
    const packed = b64ToBytes(match[3]);
    return {
      version: 2,
      pepperVersion: Number(match[2]),
      iv: packed.slice(0, IV_BYTES),
      ciphertext: packed.slice(IV_BYTES),
    };
  },

  formatEnvelopeV2(pepperVersion: number, iv: Uint8Array, ciphertext: Uint8Array): string {
    const packed = new Uint8Array(iv.length + ciphertext.length);
    packed.set(iv, 0);
    packed.set(ciphertext, iv.length);
    return `v2.${pepperVersion}.${bytesToB64(packed)}`;
  },

  /** Generate a new Ed25519 identity, wrapped in a v2 envelope. */
  async generateAndEncrypt(
    // Kept for signature stability with decryptAndRestore's (encryptedKey, userId)
    // shape and existing call sites — v2 itself doesn't need it (see reEncryptToV2).
    _userId: string,
  ): Promise<{ identity: Ed25519KeyIdentity; encryptedKey: string }> {
    const identity = Ed25519KeyIdentity.generate();
    const encryptedKey = await this.reEncryptToV2(identity);
    return { identity, encryptedKey };
  },

  /** Wrap an existing identity in a fresh v2 envelope (used by keygen and migration). */
  async reEncryptToV2(identity: Ed25519KeyIdentity): Promise<string> {
    // v2 binds the user server-side via the JWT — no userId input needed.
    const secretKey = new Uint8Array(identity.getKeyPair().secretKey);
    const { key, pepperVersion } = await deriveKeyV2();
    const { iv, ciphertext } = await encryptWith(key, secretKey);
    return this.formatEnvelopeV2(pepperVersion, iv, ciphertext);
  },

  /** Decrypt a stored blob of either version and reconstruct the identity. */
  async decryptAndRestore(encryptedKey: string, userId: string): Promise<Ed25519KeyIdentity> {
    const envelope = this.parseEnvelope(encryptedKey);
    const key =
      envelope.version === 1
        ? await deriveKeyV1(userId)
        // Ask for the version stamped on THIS blob, never the current one —
        // otherwise rotation bricks every un-migrated key.
        : (await deriveKeyV2(envelope.pepperVersion)).key;

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv: new Uint8Array(envelope.iv) },
      key,
      new Uint8Array(envelope.ciphertext),
    );
    return Ed25519KeyIdentity.fromSecretKey(new Uint8Array(decrypted));
  },
};
