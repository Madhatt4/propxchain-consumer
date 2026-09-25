import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const WELL_KNOWN = path.join(ROOT, 'public/.well-known')

interface Entry {
  identifier: string
  displayName: string
  type: string
  mediaType?: string
  url?: string
  data?: unknown
  representativeQueries?: string[]
}
interface Manifest { specVersion: string; host: { displayName: string }; entries: Entry[] }

const ard = readFileSync(path.join(WELL_KNOWN, 'ard.json'), 'utf-8')
const catalog = readFileSync(path.join(WELL_KNOWN, 'ai-catalog.json'), 'utf-8')
const manifest = JSON.parse(ard) as Manifest

// ai-catalog.schema.json (ards-project/ard-spec): identifier pattern and required fields.
const URN = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/

describe('ARD capability manifest', () => {
  it('should serve identical bytes at the current and predecessor paths', () => {
    expect(catalog).toBe(ard)
  })

  it('should carry specVersion, host and at least one entry', () => {
    expect(manifest.specVersion).toBe('1.0')
    expect(manifest.host.displayName).toBe('PropXchain')
    expect(manifest.entries.length).toBeGreaterThan(0)
  })

  it('should give every entry a domain-anchored URN, a name, a media type and exactly one of url or data', () => {
    const ids = manifest.entries.map((e) => e.identifier)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of manifest.entries) {
      expect(e.identifier).toMatch(URN)
      expect(e.identifier.startsWith('urn:air:propxchain.com:')).toBe(true)
      expect(e.displayName.length).toBeGreaterThan(0)
      expect(e.type).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/)
      expect(e.mediaType).toBe(e.type)
      expect(Boolean(e.url) !== Boolean(e.data)).toBe(true)
    }
  })

  it('should give every entry 2 to 5 representative queries', () => {
    for (const e of manifest.entries) {
      expect(e.representativeQueries?.length, e.identifier).toBeGreaterThanOrEqual(2)
      expect(e.representativeQueries?.length, e.identifier).toBeLessThanOrEqual(5)
    }
  })

  it('should only point at documents this repo publishes', () => {
    for (const e of manifest.entries) {
      const url = new URL(e.url as string)
      expect(url.origin).toBe('https://propxchain.com')
      expect(existsSync(path.join(ROOT, 'public', url.pathname)), e.url).toBe(true)
    }
  })

  it('should be announced in robots.txt and the page head', () => {
    const robots = readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf-8')
    expect(robots).toContain('Agentmap: https://propxchain.com/.well-known/ard.json')
    expect(robots).toContain('Agentmap: https://propxchain.com/.well-known/ai-catalog.json')
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf-8')
    expect(html).toContain('<link rel="ard" href="/.well-known/ard.json" />')
    expect(html).toContain('<link rel="ai-catalog" href="/.well-known/ai-catalog.json" />')
  })

  it('should be served as JSON with CORS at both paths', () => {
    const rules = readFileSync(path.join(ROOT, 'public/.ic-assets.json5'), 'utf-8')
    for (const name of ['ard.json', 'ai-catalog.json']) {
      const idx = rules.indexOf(`"match": ".well-known/${name}"`)
      expect(idx, name).toBeGreaterThan(-1)
      const rule = rules.slice(idx, rules.indexOf('"ignore"', idx))
      expect(rule).toContain('"Content-Type": "application/json; charset=utf-8"')
      expect(rule).toContain('"Access-Control-Allow-Origin": "*"')
    }
  })
})
