#!/usr/bin/env node
/**
 * Generates (or rotates) the Web Bot Auth Ed25519 key pair.
 *
 *   node scripts/web-bot-auth-keygen.mjs <private-key-output-dir>
 *
 * Writes the public JWKS to public/.well-known/http-message-signatures-directory
 * (committed) and private.jwk.json + private.pem to the given directory, which
 * must be outside the repo. Load the private JWK into the signing bot as a
 * secret, e.g. `wrangler secret put WEB_BOT_AUTH_PRIVATE_JWK < private.jwk.json`.
 * kid is the RFC 7638 JWK thumbprint, so receivers can pin it.
 */
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) throw new Error('usage: web-bot-auth-keygen.mjs <private-key-output-dir>');
const repoRoot = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (path.resolve(outDir).startsWith(repoRoot)) throw new Error('private key directory must be outside the repo');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const kid = createHash('sha256')
  .update(JSON.stringify({ crv: pub.crv, kty: pub.kty, x: pub.x }))
  .digest('base64url');
const now = Math.floor(Date.now() / 1000);
const jwks = {
  keys: [{ kty: 'OKP', crv: 'Ed25519', kid, x: pub.x, alg: 'EdDSA', use: 'sig', nbf: now, exp: now + 365 * 86400 }],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'private.jwk.json'), JSON.stringify({ ...priv, kid, alg: 'EdDSA' }, null, 2) + '\n', { mode: 0o600 });
writeFileSync(path.join(outDir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(path.join(repoRoot, 'public/.well-known/http-message-signatures-directory'), JSON.stringify(jwks, null, 2) + '\n');
console.log(`kid ${kid}\npublic JWKS -> public/.well-known/http-message-signatures-directory\nprivate key -> ${path.resolve(outDir)}`);
