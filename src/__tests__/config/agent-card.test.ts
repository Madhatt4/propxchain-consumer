import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const WELL_KNOWN = path.resolve(__dirname, '../../../public/.well-known')

interface Skill {
  id: string
  name: string
  description: string
}
interface Card {
  name: string
  version: string
  description: string
  supportedInterfaces: Array<{ url: string; protocolBinding: string }>
  capabilities: Record<string, boolean>
  skills: Skill[]
}

const card = JSON.parse(readFileSync(path.join(WELL_KNOWN, 'agent-card.json'), 'utf-8')) as Card
const mcp = JSON.parse(readFileSync(path.join(WELL_KNOWN, 'mcp.json'), 'utf-8')) as { version: string }

describe('A2A agent card', () => {
  it('should carry name, version and description', () => {
    expect(card.name).toBe('PropXchain Conveyancer')
    expect(card.version).toBe(mcp.version)
    expect(card.description.length).toBeGreaterThan(40)
  })

  it('should point every interface at the live MCP gateway over JSON-RPC', () => {
    expect(card.supportedInterfaces.length).toBeGreaterThan(0)
    for (const i of card.supportedInterfaces) {
      expect(i.url).toBe('https://mcp.propxchain.com/mcp')
      expect(i.protocolBinding).toBe('JSONRPC')
    }
  })

  it('should list capabilities and well-formed, unique skills', () => {
    expect(Object.keys(card.capabilities)).toEqual(
      expect.arrayContaining(['streaming', 'pushNotifications']),
    )
    expect(card.skills.length).toBeGreaterThan(0)
    const ids = card.skills.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of card.skills) {
      expect(s.id).toMatch(/^[a-z][a-z0-9-]+$/)
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.description.length).toBeGreaterThan(20)
    }
  })

  it('should be served as JSON with CORS from the asset canister', () => {
    const rules = readFileSync(path.resolve(WELL_KNOWN, '../.ic-assets.json5'), 'utf-8')
    const idx = rules.indexOf('"match": ".well-known/agent-card.json"')
    expect(idx).toBeGreaterThan(-1)
    const rule = rules.slice(idx, rules.indexOf('"ignore"', idx))
    expect(rule).toContain('"Content-Type": "application/json; charset=utf-8"')
    expect(rule).toContain('"Access-Control-Allow-Origin": "*"')
  })
})
