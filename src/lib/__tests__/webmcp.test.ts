import { describe, expect, it, vi } from 'vitest'
import { PAID_ITEMS } from '@/constants/pricing'
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

  it('should report the platform as free, with third-party items paid per item', () => {
    const result = byName('propxchain_get_pricing').execute({}) as {
      platformPriceGbp: number
      paidPerItem: Array<{ item: string; priceGbp: number | null }>
    }
    const priceOf = (item: string): number | null | undefined =>
      result.paidPerItem.find((r) => r.item === item)?.priceGbp
    expect(result.platformPriceGbp).toBe(0)
    expect(result.paidPerItem.map((r) => r.item)).toEqual(PAID_ITEMS.map((i) => i.label))
    expect(priceOf('HM Land Registry title')).toBe(7)
    expect(priceOf('Property chain check')).toBe(25)
    // Searches and conveyancers have no fixed price, so the tool must not quote one.
    expect(priceOf('Property searches')).toBeNull()
    expect(priceOf('Conveyancer')).toBeNull()
  })

  it('should never mention tiers or a £75 charge in the pricing tool', () => {
    const json = JSON.stringify(byName('propxchain_get_pricing').execute({}))
    expect(json).not.toMatch(/Premium|Starter|£75|"priceGbp":75/)
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
