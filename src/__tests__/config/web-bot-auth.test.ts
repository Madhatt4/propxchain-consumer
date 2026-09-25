import { createHash, generateKeyPairSync } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { signRequest, verifyRequest } from '../../../scripts/web-bot-auth/sign.mjs'

const DIRECTORY = path.resolve(__dirname, '../../../public/.well-known/http-message-signatures-directory')
interface Jwk { kty: string; crv: string; kid: string; x: string; alg: string; use: string; nbf: number; exp: number }
const jwks = JSON.parse(readFileSync(DIRECTORY, 'utf-8')) as { keys: Jwk[] }

function thumbprint(k: Jwk): string {
  return createHash('sha256').update(JSON.stringify({ crv: k.crv, kty: k.kty, x: k.x })).digest('base64url')
}

describe('Web Bot Auth key directory', () => {
  it('should publish at least one Ed25519 signing key', () => {
    expect(jwks.keys.length).toBeGreaterThan(0)
    for (const k of jwks.keys) {
      expect(k.kty).toBe('OKP')
      expect(k.crv).toBe('Ed25519')
      expect(k.alg).toBe('EdDSA')
      expect(k.use).toBe('sig')
      expect(k.x).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })

  it('should use the RFC 7638 thumbprint as kid', () => {
    for (const k of jwks.keys) expect(k.kid).toBe(thumbprint(k))
  })

  it('should not have expired', () => {
    const now = Math.floor(Date.now() / 1000)
    for (const k of jwks.keys) expect(k.exp).toBeGreaterThan(now)
  })

  it('should contain no private key material', () => {
    expect(readFileSync(DIRECTORY, 'utf-8')).not.toMatch(/"d"\s*:/)
  })

  it('should be served with the signatures-directory media type and CORS', () => {
    const rules = readFileSync(path.resolve(DIRECTORY, '../../.ic-assets.json5'), 'utf-8')
    const idx = rules.indexOf('"match": ".well-known/http-message-signatures-directory"')
    expect(idx).toBeGreaterThan(-1)
    const rule = rules.slice(idx, rules.indexOf('"ignore"', idx))
    expect(rule).toContain('"Content-Type": "application/http-message-signatures-directory+json"')
    expect(rule).toContain('"Access-Control-Allow-Origin": "*"')
  })
})

describe('signRequest', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pub = publicKey.export({ format: 'jwk' }) as Jwk
  const priv = { ...(privateKey.export({ format: 'jwk' }) as Record<string, string>), kid: 'test-kid' }
  const url = 'https://example.org/some/path?q=1'

  it('should emit Signature-Agent, Signature-Input and Signature headers', () => {
    const h = signRequest(url, priv, 1_700_000_000)
    expect(h['Signature-Agent']).toBe('https://propxchain.com')
    expect(h['Signature-Input']).toBe(
      'sig1=("@authority" "signature-agent");created=1700000000;expires=1700000300;keyid="test-kid";alg="ed25519";tag="web-bot-auth"',
    )
    expect(h.Signature).toMatch(/^sig1=:[A-Za-z0-9+/=]+:$/)
  })

  it('should verify with the matching public key inside the validity window', () => {
    const h = signRequest(url, priv, 1_700_000_000)
    expect(verifyRequest(url, h, pub, 1_700_000_100)).toBe(true)
  })

  it('should fail verification after expiry, for another authority, or another key', () => {
    const h = signRequest(url, priv, 1_700_000_000)
    expect(verifyRequest(url, h, pub, 1_700_000_300)).toBe(false)
    expect(verifyRequest('https://other.example/x', h, pub, 1_700_000_100)).toBe(false)
    const otherPub = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }) as Jwk
    expect(verifyRequest(url, h, otherPub, 1_700_000_100)).toBe(false)
  })
})
