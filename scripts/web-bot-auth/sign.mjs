/**
 * Web Bot Auth request signing (RFC 9421 HTTP Message Signatures, Ed25519)
 * for PropXchain's outbound bots. Receivers fetch the public key from the
 * Signature-Agent origin's /.well-known/http-message-signatures-directory
 * and verify. Kept dependency-free so any Worker or Node bot can import it.
 */
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const SIGNATURE_AGENT = 'https://propxchain.com';
const COMPONENTS = ['@authority', 'signature-agent'];

/** Builds the RFC 9421 signature base for the covered components. */
export function signatureBase(authority, params) {
  const lines = [
    `"@authority": ${authority}`,
    `"signature-agent": ${SIGNATURE_AGENT}`,
    `"@signature-params": ${params}`,
  ];
  return lines.join('\n');
}

function signatureParams(keyId, created, expires) {
  const covered = COMPONENTS.map((c) => `"${c}"`).join(' ');
  return `(${covered});created=${created};expires=${expires};keyid="${keyId}";alg="ed25519";tag="web-bot-auth"`;
}

/**
 * Returns the three headers to add to an outbound request. `privateJwk` is
 * the OKP/Ed25519 private JWK written by web-bot-auth-keygen.mjs; `url` is
 * the request target (only its authority is covered).
 */
export function signRequest(url, privateJwk, now = Math.floor(Date.now() / 1000), ttlSeconds = 300) {
  const authority = new URL(url).host;
  const params = signatureParams(privateJwk.kid, now, now + ttlSeconds);
  const base = signatureBase(authority, params);
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' });
  const sig = sign(null, Buffer.from(base, 'utf8'), key).toString('base64');
  return {
    'Signature-Agent': SIGNATURE_AGENT,
    'Signature-Input': `sig1=${params}`,
    Signature: `sig1=:${sig}:`,
  };
}

/** Verifies headers produced by signRequest against a public JWK. Test aid. */
export function verifyRequest(url, headers, publicJwk, now = Math.floor(Date.now() / 1000)) {
  const input = headers['Signature-Input'];
  const sigHeader = headers.Signature;
  if (!input?.startsWith('sig1=') || !sigHeader?.startsWith('sig1=:')) return false;
  const params = input.slice('sig1='.length);
  const expires = Number(/;expires=(\d+)/.exec(params)?.[1]);
  const created = Number(/;created=(\d+)/.exec(params)?.[1]);
  if (!(created <= now && now < expires)) return false;
  const base = signatureBase(new URL(url).host, params);
  const sig = Buffer.from(sigHeader.slice('sig1=:'.length, -1), 'base64');
  const key = createPublicKey({ key: publicJwk, format: 'jwk' });
  return verify(null, Buffer.from(base, 'utf8'), key, sig);
}
