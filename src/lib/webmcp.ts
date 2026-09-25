/**
 * WebMCP: exposes the site's key public actions to agents running inside the
 * user's browser via navigator.modelContext (webmachinelearning.github.io/webmcp).
 * Registered once at startup from main.tsx; a no-op in browsers without the
 * API. Tools only surface facts and routes the app already has, so nothing
 * here can drift from the product: pricing comes from TIER_METADATA and the
 * article index from resourcesMeta.
 */
import { TIER_METADATA } from '@/constants/subscriptionFeatures';
import { articlePath, liveCategories, RESOURCES } from '@/pages/resources/resourcesMeta';

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

interface ModelContext {
  registerTool: (tool: ToolDescriptor, options?: { signal?: AbortSignal }) => unknown;
  unregisterTool?: (name: string) => unknown;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

/** Public destinations an agent may send the user to; anything else is refused. */
export const NAVIGATION_TARGETS = {
  home: '/',
  'how-it-works': '/how-it-works',
  features: '/features',
  pricing: '/pricing',
  sellers: '/sellers',
  buyers: '/buyers',
  conveyancers: '/conveyancers',
  'estate-agents': '/estate-agent',
  resources: '/resources',
  faq: '/faq',
  'find-a-conveyancer': '/find-a-conveyancer',
  'sell-my-house': '/sell-my-house',
  register: '/register',
  login: '/login',
} as const;

export type NavigationTarget = keyof typeof NAVIGATION_TARGETS;

export function buildTools(navigate: (path: string) => void): ToolDescriptor[] {
  return [
    {
      name: 'propxchain_navigate',
      description:
        'Open one of the public PropXchain pages for the user: how it works, features, pricing, seller/buyer/conveyancer/estate-agent pages, resources hub, FAQ, find a conveyancer, sell my house, register or login.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'string', enum: Object.keys(NAVIGATION_TARGETS), description: 'Destination page' },
        },
        required: ['page'],
      },
      execute: ({ page }) => {
        const path = NAVIGATION_TARGETS[page as NavigationTarget];
        if (!path) throw new Error(`Unknown page "${String(page)}"`);
        navigate(path);
        return { navigatedTo: path };
      },
    },
    {
      name: 'propxchain_search_resources',
      description:
        'Search PropXchain\'s published plain-English guides on UK conveyancing (selling, buying, searches and legal, probate, auction, industry reform). Returns matching articles with their URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match against article titles and teasers' },
          category: {
            type: 'string',
            enum: liveCategories().map((c) => c.slug),
            description: 'Optional category slug to restrict the search',
          },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
        },
        required: ['query'],
      },
      execute: ({ query, category, limit }) => searchResources(String(query), category as string | undefined, Number(limit ?? 5)),
    },
    {
      name: 'propxchain_get_pricing',
      description:
        'Return PropXchain\'s current tiers and prices in GBP: the free Starter tier and the per-transaction Premium tier.',
      inputSchema: { type: 'object', properties: {} },
      execute: () =>
        Object.values(TIER_METADATA).map((tier) => ({
          tier: tier.displayName,
          description: tier.description,
          pricePerTransactionGbp: tier.annualPrice,
        })),
    },
  ];
}

export function searchResources(query: string, category?: string, limit = 5): Array<{ title: string; teaser: string; url: string; category: string }> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return RESOURCES.filter((r): r is Extract<typeof r, { status: 'published' }> => r.status === 'published')
    .filter((r) => !category || r.category === category)
    .map((r) => {
      const haystack = `${r.title} ${r.teaser}`.toLowerCase();
      const score = terms.filter((t) => haystack.includes(t)).length;
      return { r, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(20, limit)))
    .map(({ r }) => ({
      title: r.title,
      teaser: r.teaser,
      url: `https://propxchain.com${articlePath(r)}`,
      category: r.category,
    }));
}

/**
 * Registers the tools if the browser exposes WebMCP. Returns the controller
 * whose abort() unregisters them, or null when the API is absent.
 */
export function registerWebMcpTools(
  nav: Navigator = navigator,
  navigate: (path: string) => void = (path) => { window.location.assign(path); },
): AbortController | null {
  const ctx = nav.modelContext;
  if (!ctx || typeof ctx.registerTool !== 'function') return null;
  const controller = new AbortController();
  const tools = buildTools(navigate);
  for (const tool of tools) ctx.registerTool(tool, { signal: controller.signal });
  controller.signal.addEventListener('abort', () => {
    if (typeof ctx.unregisterTool === 'function') for (const tool of tools) ctx.unregisterTool(tool.name);
  });
  return controller;
}
