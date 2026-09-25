import { supabase } from '@/lib/supabase';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

const WORKER_URL = import.meta.env.VITE_RIGHTMOVE_WORKER_URL;
if (!WORKER_URL && import.meta.env.PROD) {
  throw new Error('VITE_RIGHTMOVE_WORKER_URL is required in production');
}

export interface ScrapeResponse {
  listing: PropertyListing;
  provenance: ProvenanceMap;
}

/** A listing portal the worker has an adapter for. */
export type Portal = 'rightmove' | 'purplebricks' | 'onthemarket';

interface PortalRule {
  portal: Portal;
  /** Registrable domain. Matched exactly or as a dot-delimited subdomain. */
  host: string;
  /** True when this path is a single property listing rather than a search page. */
  isListingPath: (pathname: string) => boolean;
}

/**
 * Exact host, or a true subdomain of it.
 *
 * NOT a bare `hostname.endsWith(host)`: that also matches a lookalike whose
 * name merely *ends* with the string, and `notrightmove.co.uk` is a domain
 * anyone can register. This value gates what gets handed to the scraper worker,
 * which then fetches it server-side, so a suffix match would let an attacker
 * pick the URL the worker retrieves.
 */
function isHostOrSubdomain(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/**
 * One table drives both "is this a listing URL" and "which portal is it".
 *
 * These were two hand-maintained lists and they had already drifted:
 * `isValidListingUrl` accepted onthemarket.com while `detectPortal` returned
 * null for it, because OnTheMarket was added to one and not the other. Adding a
 * portal in one place and forgetting the other is the whole bug class — so a new
 * portal goes here, once, and both functions pick it up.
 */
const PORTAL_RULES: readonly PortalRule[] = [
  {
    portal: 'rightmove',
    host: 'rightmove.co.uk',
    isListingPath: (p) => p.includes('/properties/') || p.includes('/property-for-sale/'),
  },
  {
    portal: 'purplebricks',
    host: 'purplebricks.co.uk',
    isListingPath: (p) => /\/property-for-sale\/[a-z0-9-]+-\d+\/?$/i.test(p),
  },
  {
    portal: 'onthemarket',
    host: 'onthemarket.com',
    isListingPath: (p) => /^\/details\/\d+\/?$/.test(p),
  },
];

/**
 * Resolve a URL to its portal and whether the path is a property listing.
 * Returns null for anything that is not a supported portal over http(s).
 */
function matchPortal(url: string): { portal: Portal; isListing: boolean } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const rule = PORTAL_RULES.find((r) => isHostOrSubdomain(u.hostname, r.host));
    if (!rule) return null;
    return { portal: rule.portal, isListing: rule.isListingPath(u.pathname) };
  } catch {
    return null;
  }
}

export function isValidListingUrl(url: string): boolean {
  return matchPortal(url)?.isListing ?? false;
}

/**
 * Which portal a URL belongs to, regardless of whether the path is a listing —
 * `https://www.rightmove.co.uk/` is still Rightmove. Use `isValidListingUrl` to
 * decide whether it can actually be scraped.
 */
export function detectPortal(url: string): Portal | null {
  return matchPortal(url)?.portal ?? null;
}

/**
 * Restore the array fields `PropertyListing` declares as always-present.
 *
 * The worker omits a field entirely when no extraction tier produced one, and
 * an empty array counts as "not produced" — so a listing with no photos or no
 * key features arrived with the keys absent, not empty. Consumers trust the
 * declared type and read `.length`, which threw and tripped the global
 * ErrorBoundary. The worker now emits `[]` itself; this stays as the boundary
 * guarantee, because the response is untrusted input and KV-cached payloads
 * written before that fix are served for up to 7 days.
 */
function normaliseListing(listing: PropertyListing): PropertyListing {
  return {
    ...listing,
    images: Array.isArray(listing?.images) ? listing.images : [],
    keyFeatures: Array.isArray(listing?.keyFeatures) ? listing.keyFeatures : [],
  };
}

export async function scrapeListing(url: string): Promise<ScrapeResponse> {
  if (!isValidListingUrl(url)) throw new Error('Please enter a valid URL');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in to import listings');

  const res = await fetch(`${WORKER_URL}/scrape-listing`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = JSON.parse(text); } catch { body = null; }

  if (!res.ok) {
    const msg = body?.error || `Worker returned ${res.status}`;
    throw new Error(msg);
  }

  const parsed = body as ScrapeResponse | null;
  if (!parsed?.listing) throw new Error("Couldn't read this listing. Paste details manually?");

  return { listing: normaliseListing(parsed.listing), provenance: parsed.provenance ?? {} };
}

export const listingService = { scrapeListing, isValidListingUrl, detectPortal };
