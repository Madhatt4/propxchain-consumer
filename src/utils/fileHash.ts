/**
 * File hashing utility for PropXchain.
 * Uses Web Crypto API — no external dependencies, works in all modern browsers.
 */

/**
 * Compute the SHA-256 digest of a File and return it as a lowercase hex string.
 * The file content is read via arrayBuffer() which is non-destructive.
 */
export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 of a UTF-8 string as lowercase hex, for anchoring personal data
 * on-chain by digest instead of in plaintext.
 */
export async function sha256HexOfText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
