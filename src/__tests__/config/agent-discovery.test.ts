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

describe('homepage crawler summary', () => {
  // Fetch tools hand a model only the first few KB of a page, so the MCP
  // pointer must sit in the meta description and right under the h1, not
  // only in the FAQ and About sections at the bottom.
  it('names the MCP endpoint in the meta description', () => {
    const meta = read('index.html').match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
    expect(meta).toContain('mcp.propxchain.com/mcp')
    expect(meta).toContain('Propchain')
  })

  it('names the MCP endpoint in the first paragraph after the h1', () => {
    const html = read('index.html')
    const afterH1 = html.slice(html.indexOf('<main id="seo-fallback"'))
    const firstSection = afterH1.slice(0, afterH1.indexOf('<section'))
    expect(firstSection).toContain(MCP_URL)
  })
})

// Search engines (Bing flags it as an SEO issue) want every meta description
// between 25 and 160 characters, including the per-route ones the prerender
// script swaps in.
describe('meta description length', () => {
  const metaDescription = (html: string) =>
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]

  it.each(['index.html', 'public/agent.html'])('%s is 25-160 characters', (file) => {
    const meta = metaDescription(read(file)) ?? ''
    expect(meta.length).toBeGreaterThanOrEqual(25)
    expect(meta.length).toBeLessThanOrEqual(160)
  })

  it('every prerendered marketing route is 25-160 characters', () => {
    const descriptions = [...read('scripts/prerender-marketing.mjs').matchAll(/description: '([^']*)'/g)].map(
      (m) => m[1],
    )
    expect(descriptions.length).toBeGreaterThan(5)
    for (const d of descriptions) {
      expect(d.length, d).toBeGreaterThanOrEqual(25)
      expect(d.length, d).toBeLessThanOrEqual(160)
    }
  })
})
