import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Ed25519KeyIdentity } from '@propxchain/core-client';

const mockGetMaterial = vi.fn();
vi.mock('../keyMaterial.service', () => ({
  keyMaterialService: { getMaterial: (v?: number) => mockGetMaterial(v) },
}));

import { KeyPairService, UnsupportedEnvelopeError } from '../keyPair.service';

const USER = 'u1';
const MATERIAL = new Uint8Array(32).fill(7);

const V1_SALT = 'propxchain-keypair-v1';

/**
 * Local reproduction of the legacy v1 wrapping. Production code only ever
 * DECRYPTS v1 (see keyPair.service.ts) — it never mints one. This helper
 * exists so tests can fabricate v1 fixtures without shipping a live v1
 * encryptor in application code.
 */
async function makeV1Blob(
  userId: string,
): Promise<{ blob: string; identity: Ed25519KeyIdentity }> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId + V1_SALT),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(V1_SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const identity = Ed25519KeyIdentity.generate();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new Uint8Array(identity.getKeyPair().secretKey),
    ),
  );
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);
  let binary = '';
  for (const b of packed) binary += String.fromCharCode(b);
  return { blob: btoa(binary), identity };
}

describe('parseEnvelope', () => {
  it('should parse a bare base64 blob as v1', () => {
    const env = KeyPairService.parseEnvelope(btoa('x'.repeat(40)));
    expect(env.version).toBe(1);
  });

  it('should parse a v2 blob and read its pepper version', () => {
    const env = KeyPairService.parseEnvelope(`v2.3.${btoa('x'.repeat(40))}`);
    expect(env.version).toBe(2);
    if (env.version === 2) expect(env.pepperVersion).toBe(3);
  });

  it('should still parse a v1 blob whose first byte is 0x02 as v1', () => {
    // Guards the magic-byte trap: a v1 blob starts with a random IV byte, so
    // 0x02 collides 1-in-256. Detection MUST be by string prefix.
    const packed = new Uint8Array(44);
    packed[0] = 0x02;
    const blob = btoa(String.fromCharCode(...packed));
    expect(KeyPairService.parseEnvelope(blob).version).toBe(1);
  });

  it('should reject an unknown envelope version rather than fall through to v1', () => {
    expect(() => KeyPairService.parseEnvelope(`v3.1.${btoa('xxxx')}`)).toThrow(
      UnsupportedEnvelopeError,
    );
  });
});

describe('v2 round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMaterial.mockResolvedValue({ material: MATERIAL, pepperVersion: 1 });
  });

  it('should encrypt to a v2 envelope and decrypt back to the same principal', async () => {
    const { identity, encryptedKey } = await KeyPairService.generateAndEncrypt(USER);
    expect(encryptedKey.startsWith('v2.1.')).toBe(true);

    const restored = await KeyPairService.decryptAndRestore(encryptedKey, USER);
    expect(restored.getPrincipal().toText()).toBe(identity.getPrincipal().toText());
  });

  it('should request the blob own pepper version when decrypting an older blob', async () => {
    mockGetMaterial.mockResolvedValue({ material: MATERIAL, pepperVersion: 1 });
    const { encryptedKey } = await KeyPairService.generateAndEncrypt(USER);
    mockGetMaterial.mockClear();

    await KeyPairService.decryptAndRestore(encryptedKey, USER);

    // Rotation safety: decrypt must ask for the version stamped on the blob,
    // never the current one. Otherwise rotation bricks every un-migrated key.
    expect(mockGetMaterial).toHaveBeenCalledWith(1);
  });

  it('should reject material that is not exactly 32 bytes', async () => {
    mockGetMaterial.mockResolvedValue({ material: new Uint8Array(16), pepperVersion: 1 });
    await expect(KeyPairService.generateAndEncrypt(USER)).rejects.toThrow();
  });
});

describe('v1 -> v2 migration preserves the principal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMaterial.mockResolvedValue({ material: MATERIAL, pepperVersion: 1 });
  });

  it('should decrypt a v1 blob and re-encrypt it to v2 with an identical principal', async () => {
    const { blob: v1Blob } = await makeV1Blob(USER);
    const fromV1 = await KeyPairService.decryptAndRestore(v1Blob, USER);

    const v2Blob = await KeyPairService.reEncryptToV2(fromV1);
    expect(v2Blob.startsWith('v2.1.')).toBe(true);

    const fromV2 = await KeyPairService.decryptAndRestore(v2Blob, USER);
    // Principal stability is the property that matters.
    expect(fromV2.getPrincipal().toText()).toBe(fromV1.getPrincipal().toText());
  });

  it('should decrypt a v1 blob with NO oracle call (v1 fallback keeps login working)', async () => {
    // Rollout must degrade, not lock out: while the oracle is down, v1 users
    // still sign in. v1 derivation needs nothing from the server.
    const { blob: v1Blob } = await makeV1Blob(USER);
    mockGetMaterial.mockRejectedValue(new Error('oracle unreachable'));

    const identity = await KeyPairService.decryptAndRestore(v1Blob, USER);

    expect(identity.getPrincipal().toText()).toBeTruthy();
    expect(mockGetMaterial).not.toHaveBeenCalled();
  });

  it('should surface an error (never a silent null) when a v2 blob meets a dead oracle', async () => {
    const { encryptedKey } = await KeyPairService.generateAndEncrypt(USER);
    mockGetMaterial.mockRejectedValue(new Error('oracle unreachable'));

    await expect(KeyPairService.decryptAndRestore(encryptedKey, USER)).rejects.toThrow();
  });

  it('should tolerate two concurrent migrations of the same key (two-tab idempotence)', async () => {
    // Two tabs migrate the same v1 blob at once. Distinct IVs, so distinct
    // ciphertexts — last-write-wins must still leave a decryptable blob of the
    // same identity.
    const { blob: v1Blob } = await makeV1Blob(USER);
    const identity = await KeyPairService.decryptAndRestore(v1Blob, USER);

    const [tabA, tabB] = await Promise.all([
      KeyPairService.reEncryptToV2(identity),
      KeyPairService.reEncryptToV2(identity),
    ]);

    expect(tabA).not.toBe(tabB); // fresh IV per encrypt
    for (const blob of [tabA, tabB]) {
      const restored = await KeyPairService.decryptAndRestore(blob, USER);
      expect(restored.getPrincipal().toText()).toBe(identity.getPrincipal().toText());
    }
  });
});
