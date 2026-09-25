import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const WELL_KNOWN = path.resolve(__dirname, '../../../public/.well-known')
interface Link { href: string; type?: string; title?: string }
interface Context { anchor: string; item?: Link[]; 'service-desc'?: Link[]; 'service-doc'?: Link[] }
const catalog = JSON.parse(readFileSync(path.join(WELL_KNOWN, 'api-catalog'), 'utf-8')) as { linkset: Context[] }

describe('API catalog (RFC 9727 linkset)', () => {
  it('should anchor the catalog on its own well-known URL and list the APIs as items', () => {
    const root = catalog.linkset.find((c) => c.anchor === 'https://propxchain.com/.well-known/api-catalog')
    expect(root?.item?.map((l) => l.href)).toEqual([
      'https://mcp.propxchain.com/mcp',
      'https://auth.propxchain.com',
    ])
  })

  it('should give every listed API a context with a service description', () => {
    const root = catalog.linkset.find((c) => c.anchor === 'https://propxchain.com/.well-known/api-catalog')
    for (const api of root?.item ?? []) {
      const ctx = catalog.linkset.find((c) => c.anchor === api.href)
      expect(ctx, `${api.href} has no context`).toBeDefined()
      expect(ctx?.['service-desc']?.length).toBeGreaterThan(0)
    }
  })

  it('should only reference documents this repo publishes or live external metadata', () => {
    const local = new Set(['mcp.json', 'agent-card.json', 'agent-skills/index.json'])
    for (const ctx of catalog.linkset) {
      for (const link of [...(ctx['service-desc'] ?? []), ...(ctx['service-doc'] ?? [])]) {
        const url = new URL(link.href)
        if (url.hostname === 'propxchain.com' && url.pathname.startsWith('/.well-known/')) {
          expect(local.has(url.pathname.slice('/.well-known/'.length)), link.href).toBe(true)
        }
        expect(link.type).toBeTruthy()
      }
    }
  })

  it('should be served as application/linkset+json with CORS', () => {
    const rules = readFileSync(path.resolve(WELL_KNOWN, '../.ic-assets.json5'), 'utf-8')
    const idx = rules.indexOf('"match": ".well-known/api-catalog"')
    expect(idx).toBeGreaterThan(-1)
    const rule = rules.slice(idx, rules.indexOf('"ignore"', idx))
    expect(rule).toContain('"Content-Type": "application/linkset+json"')
    expect(rule).toContain('"Access-Control-Allow-Origin": "*"')
  })
})
