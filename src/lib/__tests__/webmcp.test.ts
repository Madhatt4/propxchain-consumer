import { describe, expect, it, vi } from 'vitest'
import { TIER_METADATA } from '@/constants/subscriptionFeatures'
import { buildTools, NAVIGATION_TARGETS, registerWebMcpTools, searchResources } from '../webmcp'

interface Tool {
  name: string
  description: string
  inputSchema: { type: string; properties: Record<string, unknown>; required?: string[] }
  execute: (input: Record<string, unknown>) => unknown
}

function fakeModelContext(): { ctx: Navigator['modelContext']; registered: Tool[]; unregistered: string[]; signals: AbortSignal[] } {
  const registered: Tool[] = []
  const unregistered: string[] = []
  const signals: AbortSignal[] = []
  const ctx = {
    registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => {
      registered.push(tool)
      if (options?.signal) signals.push(options.signal)
    },
    unregisterTool: (name: string) => { unregistered.push(name) },
  }
  return { ctx: ctx as unknown as Navigator['modelContext'], registered, unregistered, signals }
}

describe('registerWebMcpTools', () => {
  it('should return null and register nothing when the browser has no modelContext', () => {
    expect(registerWebMcpTools({} as Navigator)).toBeNull()
  })

  it('should register every tool with name, description, inputSchema and execute, passing the abort signal', () => {
    const { ctx, registered, signals } = fakeModelContext()
    const controller = registerWebMcpTools({ modelContext: ctx } as Navigator)
    expect(controller).toBeInstanceOf(AbortController)
    expect(registered.map((t) => t.name)).toEqual([
      'propxchain_navigate',
      'propxchain_search_resources',
      'propxchain_get_pricing',
    ])
    for (const t of registered) {
      expect(t.description.length).toBeGreaterThan(30)
      expect(t.inputSchema.type).toBe('object')
      expect(typeof t.execute).toBe('function')
    }
    expect(signals).toHaveLength(3)
    expect(signals.every((s) => s === controller?.signal)).toBe(true)
  })

  it('should unregister all tools when the controller is aborted', () => {
    const { ctx, unregistered } = fakeModelContext()
    const controller = registerWebMcpTools({ modelContext: ctx } as Navigator)
    controller?.abort()
    expect(unregistered).toEqual(['propxchain_navigate', 'propxchain_search_resources', 'propxchain_get_pricing'])
  })
})

describe('tools', () => {
  const navigate = vi.fn()
  const tools = buildTools(navigate) as Tool[]
  const byName = (name: string): Tool => tools.find((t) => t.name === name) as Tool

  it('should navigate only to allow-listed public pages', () => {
    const nav = byName('propxchain_navigate')
    expect((nav.inputSchema.properties.page as { enum: string[] }).enum).toEqual(Object.keys(NAVIGATION_TARGETS))
    expect(nav.execute({ page: 'pricing' })).toEqual({ navigatedTo: '/pricing' })
    expect(navigate).toHaveBeenCalledWith('/pricing')
    expect(() => nav.execute({ page: '/dashboard' })).toThrow(/Unknown page/)
    expect(() => nav.execute({ page: 'admin' })).toThrow(/Unknown page/)
  })

  it('should return pricing straight from TIER_METADATA', () => {
    const result = byName('propxchain_get_pricing').execute({}) as Array<{ tier: string; pricePerTransactionGbp: number }>
    expect(result.map((r) => r.tier)).toEqual(['Starter', 'Premium'])
    expect(result[0].pricePerTransactionGbp).toBe(TIER_METADATA.starter.annualPrice)
    expect(result[1].pricePerTransactionGbp).toBe(TIER_METADATA.premium.annualPrice)
  })

  it('should search published resources and return absolute article URLs', () => {
    const hits = searchResources('searches')
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) {
      expect(h.url).toMatch(/^https:\/\/propxchain\.com\/resources\/[a-z-]+\/[a-z0-9-]+$/)
      expect(h.title.length).toBeGreaterThan(0)
    }
  })

  it('should return nothing for an empty query and respect category and limit', () => {
    expect(searchResources('   ')).toEqual([])
    const limited = searchResources('property conveyancing sign in searches', undefined, 1)
    expect(limited).toHaveLength(1)
    for (const h of searchResources('sign in', 'getting-started')) expect(h.category).toBe('getting-started')
  })
})
