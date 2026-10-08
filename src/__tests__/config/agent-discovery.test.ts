import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The files an AI assistant actually reads when asked "what is PropXchain,
// and does it have an MCP?". Each must name the live MCP endpoint and say
// PropXchain is not Propchain, so the answer can't drift back to "no MCP".
const ROOT = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf-8')
const MCP_URL = 'https://mcp.propxchain.com/mcp'

const SURFACES = [
  'public/llms.txt',
  'public/llms-full.txt',
  'public/agent.html',
  'public/.well-known/mcp.json',
  'index.html',
]

describe('agent discovery surfaces', () => {
  it.each(SURFACES)('%s names the hosted MCP endpoint', (file) => {
    expect(read(file)).toContain(MCP_URL)
  })

  it.each(SURFACES)('%s never calls the MCP server planned', (file) => {
    expect(read(file)).not.toMatch(/MCP[^\n]{0,40}\(planned\)|plans an MCP/i)
  })

  it.each(['public/llms.txt', 'public/llms-full.txt', 'index.html', 'public/.well-known/mcp.json'])(
    '%s disambiguates PropXchain from Propchain',
    (file) => {
      expect(read(file)).toMatch(/Propchain/)
    },
  )

  it('leads llms.txt with the MCP connection section, before the feature list', () => {
    const llms = read('public/llms.txt')
    expect(llms.indexOf('## Connect an AI assistant (MCP)')).toBeGreaterThan(-1)
    expect(llms.indexOf('## Connect an AI assistant (MCP)')).toBeLessThan(llms.indexOf('## Key Features'))
  })

  it('publishes the MCP server as schema.org WebAPI on the homepage', () => {
    const html = read('index.html')
    expect(html).toContain('"@type": "WebAPI"')
    expect(html).toContain(`"url": "${MCP_URL}"`)
  })
})
