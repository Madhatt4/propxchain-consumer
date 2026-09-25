import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const WELL_KNOWN = path.resolve(__dirname, '../../../public/.well-known')
const readJson = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(WELL_KNOWN, name), 'utf-8')) as Record<string, unknown>

const AUTH_SERVER = 'https://auth.propxchain.com'

describe('OAuth discovery metadata (RFC 8414 / RFC 9728)', () => {
  it('should publish authorization-server metadata with the required fields', () => {
    const doc = readJson('oauth-authorization-server')
    expect(doc.issuer).toBe(AUTH_SERVER)
    expect(doc.authorization_endpoint).toBe(`${AUTH_SERVER}/authorize`)
    expect(doc.token_endpoint).toBe(`${AUTH_SERVER}/token`)
    expect(doc.grant_types_supported).toEqual(expect.arrayContaining(['authorization_code']))
    expect(doc.response_types_supported).toEqual(expect.arrayContaining(['code']))
    expect(doc.code_challenge_methods_supported).toEqual(['S256'])
  })

  it('should publish protected-resource metadata pointing at the auth server', () => {
    const doc = readJson('oauth-protected-resource')
    expect(doc.resource).toBe('https://propxchain.com')
    expect(doc.authorization_servers).toEqual([AUTH_SERVER])
    expect(doc.bearer_methods_supported).toEqual(['header'])
  })

  it('should advertise the same scopes on the resource and the auth server', () => {
    const as = readJson('oauth-authorization-server')
    const prm = readJson('oauth-protected-resource')
    expect(prm.scopes_supported).toEqual(as.scopes_supported)
  })

  it('should serve both documents as JSON with CORS from the asset canister', () => {
    const rules = readFileSync(path.resolve(WELL_KNOWN, '../.ic-assets.json5'), 'utf-8')
    for (const name of ['oauth-authorization-server', 'oauth-protected-resource']) {
      const idx = rules.indexOf(`"match": ".well-known/${name}"`)
      expect(idx, `${name} rule missing`).toBeGreaterThan(-1)
      const rule = rules.slice(idx, rules.indexOf('"ignore"', idx))
      expect(rule).toContain('"Content-Type": "application/json; charset=utf-8"')
      expect(rule).toContain('"Access-Control-Allow-Origin": "*"')
    }
  })

  it('should give auth.md an H1 that names the protocol', () => {
    const md = readFileSync(path.resolve(WELL_KNOWN, '../auth.md'), 'utf-8')
    expect(md.split(/\r?\n/)[0]).toMatch(/^# .*auth\.md/i)
  })
})
