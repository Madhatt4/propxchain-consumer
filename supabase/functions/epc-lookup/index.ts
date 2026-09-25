import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { corsHeaders, preflight } from '../_shared/cors.ts';
import { checkRateLimit, getClientIp } from '../_shared/rate-limit.ts';

/**
 * EPC (Energy Performance Certificate) lookup edge function — scope B.
 *
 * Wraps the MHCLG "Get energy performance of buildings data" API so the
 * bearer token never leaves the server. The frontend calls this via
 * `supabase.functions.invoke('epc-lookup', { body: { postcode, addressLine }})`.
 *
 * NOTE on the API migration: the legacy `epc.opendatacommunities.org` open-data
 * API (email:key Basic auth) was retired on 30 May 2026 and now 301-redirects
 * to the new service below. The new API uses a per-account BEARER token (the
 * same key string migrated across) and a two-call model: search a postcode for
 * certificates, then fetch one certificate for the rich fields (floor area,
 * potential band, numeric ratings).
 *
 * Auth posture: deployed with --no-verify-jwt (matching companies-house-lookup
 * and the other public-lookup functions) so it works for both Supabase- and
 * Internet-Identity-authenticated users on the transaction dashboard. EPC data
 * is public open-government data; a per-IP rate limiter protects the shared
 * 6000 req / 5 min quota.
 *
 * Set the token with (dashboard → Edge Functions → Secrets, or CLI):
 *   supabase secrets set EPC_API_KEY=<bearer token from your EPB account page>
 *
 * MHCLG Energy certificate data API:
 *   Search:      GET {BASE}/api/domestic/search?postcode={pc}&page_size=100
 *   Certificate: GET {BASE}/api/certificate?certificate_number={num}
 *   Auth: Authorization: Bearer <token>
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const EPC_API_KEY =
  Deno.env.get('EPC_API_KEY') ||
  Deno.env.get('EPC_TOKEN') ||
  Deno.env.get('EPC_BEARER_TOKEN') ||
  '';
const EPC_BASE = 'https://api.get-energy-performance-data.communities.gov.uk';
const UPSTREAM_TIMEOUT_MS = 7000;

// Quota guard for the shared MHCLG token (6000 req / 5 min). This function is
// intentionally unauthenticated (EPC data is public open-government data), so
// the limiter is the ONLY thing between an anonymous caller and a paid quota.
//
// SECURITY (audit 2026-07-25, finding #7): the previous implementation kept
// counters in a per-isolate Map keyed on the LEFTMOST X-Forwarded-For entry.
// Both halves were broken. The left end of XFF is caller-supplied, so rotating
// it minted a fresh bucket per request and bypassed the cap entirely; and
// per-isolate state reset on every cold start and was not shared across
// concurrent isolates. Counters now live in Postgres via the shared limiter,
// and the key comes from headers the Supabase gateway overwrites, so a caller
// can no longer influence which bucket it lands in.
//
// CALIBRATION: Supabase does not expose the true client IP to edge functions —
// getClientIp() resolves to the platform's own edge egress pool, a handful of
// addresses shared by every caller (see _shared/rate-limit.ts). So this is a
// coarse global cap, not a per-visitor allowance, and the number is sized for
// that: 300 per bucket per 5 min across a ~4-address pool is roughly 1200 req /
// 5 min worst case, comfortably inside the 6000 upstream quota while leaving
// room for genuine concurrent users. The old value of 30 would have been a
// ~120 req / 5 min global ceiling and would have throttled real traffic.
const RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const RATE_LIMIT_MAX = 300;

// UK postcode (loose): outward + inward parts. We trust postcodes.io upstream
// for the real validation; this just rejects junk before a round trip.
const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;

interface LookupRequest {
  postcode?: string;
  addressLine?: string;
}

type EpcBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

interface EpcCertificate {
  address: string;
  postcode: string;
  /** UPRN from the EPC register, when present — lets the lister auto-fill the
   *  property identity (and unlock the precise OS Open UPRN pin) without knowing it. */
  uprn: string | null;
  currentBand: EpcBand;
  potentialBand: EpcBand | null;
  currentRating: number | null;
  potentialRating: number | null;
  floorAreaSqm: number | null;
  lodgementDate: string | null;
  meetsMees: boolean;
}

// ---- upstream shapes (only the fields we read) -----------------------------

interface SearchRow {
  certificateNumber?: string;
  uprn?: string | number;
  addressLine1?: string;
  addressLine2?: string | null;
  postcode?: string;
  postTown?: string;
  currentEnergyEfficiencyBand?: string;
  registrationDate?: string;
}

interface SearchResponse {
  data?: SearchRow[] | { error?: string };
}

interface CertificateResponse {
  data?: {
    total_floor_area?: number;
    current_energy_efficiency_band?: string;
    potential_energy_efficiency_band?: string;
    energy_rating_current?: number;
    energy_rating_potential?: number;
  };
}

// ---- helpers ----------------------------------------------------------------

function normalizeBand(raw: unknown): EpcBand | null {
  if (typeof raw !== 'string') return null;
  const b = raw.trim().toUpperCase();
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(b) ? (b as EpcBand) : null;
}

/** Lowercase, strip punctuation, collapse whitespace — for address comparison. */
function normAddr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pick the certificate row that best represents the queried dwelling.
 * If an address line is supplied, prefer an exact normalised match, then a
 * shared leading building-number/name; otherwise fall back to the most
 * recently registered certificate on the postcode.
 */
function pickBestRow(rows: SearchRow[], addressLine?: string): SearchRow | null {
  if (rows.length === 0) return null;

  const mostRecent = (): SearchRow =>
    rows.reduce((latest, r) =>
      (r.registrationDate ?? '') > (latest.registrationDate ?? '') ? r : latest,
    );

  if (!addressLine) return mostRecent();

  // The listing address is usually "86 Fairfield Road, Biggleswade, SG18 0AA";
  // EPC addressLine1 is "86 Fairfield Road". Compare against the part before
  // the first comma.
  const target = normAddr(addressLine.split(',')[0] ?? addressLine);
  const exact = rows.find((r) => r.addressLine1 && normAddr(r.addressLine1) === target);
  if (exact) return exact;

  const leadToken = target.split(' ')[0];
  if (leadToken) {
    const byNumber = rows.find((r) => {
      const a = r.addressLine1 ? normAddr(r.addressLine1) : '';
      return a === target || a.split(' ')[0] === leadToken;
    });
    if (byNumber) return byNumber;
  }
  return mostRecent();
}

async function epcFetch(path: string, signal: AbortSignal): Promise<Response> {
  return fetch(`${EPC_BASE}${path}`, {
    headers: { Authorization: `Bearer ${EPC_API_KEY}`, Accept: 'application/json' },
    signal,
  });
}

async function lookup(
  postcode: string,
  addressLine: string | undefined,
): Promise<EpcCertificate | null> {
  if (!EPC_API_KEY) {
    console.error('EPC_API_KEY env var is not set');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    // 1) Search the postcode for domestic certificates.
    const searchRes = await epcFetch(
      `/api/domestic/search?postcode=${encodeURIComponent(postcode)}&page_size=100`,
      controller.signal,
    );
    // 404 = "no certificates could be found for that query" — a normal miss.
    if (searchRes.status === 404) return null;
    if (!searchRes.ok) {
      console.error(`EPC search upstream ${searchRes.status} for ${postcode}`);
      return null;
    }
    const searchBody = (await searchRes.json()) as SearchResponse;
    const rows = Array.isArray(searchBody.data) ? searchBody.data : [];
    const row = pickBestRow(rows, addressLine);
    if (!row || !row.certificateNumber) return null;

    // 2) Fetch the full certificate for floor area + potential band + ratings.
    let detail: CertificateResponse['data'] = undefined;
    const certRes = await epcFetch(
      `/api/certificate?certificate_number=${encodeURIComponent(row.certificateNumber)}`,
      controller.signal,
    );
    if (certRes.ok) {
      detail = ((await certRes.json()) as CertificateResponse).data;
    } else {
      console.warn(`EPC certificate ${row.certificateNumber} upstream ${certRes.status}`);
    }

    const currentBand =
      normalizeBand(detail?.current_energy_efficiency_band) ??
      normalizeBand(row.currentEnergyEfficiencyBand);
    if (!currentBand) return null; // without a band there is nothing useful to show

    const addressParts = [row.addressLine1, row.addressLine2, row.postTown].filter(
      (p): p is string => Boolean(p && p.trim()),
    );

    const floorAreaSqm =
      typeof detail?.total_floor_area === 'number' && detail.total_floor_area > 0
        ? detail.total_floor_area
        : null;

    // UPRN may arrive as a number or numeric string; normalise to a clean
    // 1-12 digit string, else null (never fabricate).
    const uprnRaw = row.uprn === undefined || row.uprn === null ? '' : String(row.uprn).trim();
    const uprn = /^\d{1,12}$/.test(uprnRaw) ? uprnRaw : null;

    return {
      address: addressParts.join(', '),
      postcode: row.postcode ?? postcode,
      uprn,
      currentBand,
      potentialBand: normalizeBand(detail?.potential_energy_efficiency_band),
      currentRating:
        typeof detail?.energy_rating_current === 'number' ? detail.energy_rating_current : null,
      potentialRating:
        typeof detail?.energy_rating_potential === 'number'
          ? detail.energy_rating_potential
          : null,
      floorAreaSqm,
      lodgementDate: row.registrationDate ?? null,
      // Domestic MEES floor is band E; F and G fail.
      meetsMees: !['F', 'G'].includes(currentBand),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`EPC timeout for ${postcode}`);
    } else {
      console.error(`EPC network error for ${postcode}:`, err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return preflight(req);
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — cannot rate limit');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rl = await checkRateLimit({
    key: `epc-lookup:ip:${getClientIp(req)}`,
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    supabaseAdmin: adminClient,
  });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded', resetIn: rl.retryAfter }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) },
    });
  }

  let parsed: LookupRequest;
  try {
    parsed = (await req.json()) as LookupRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const postcode = typeof parsed.postcode === 'string' ? parsed.postcode.trim() : '';
  if (!postcode || !UK_POSTCODE_RE.test(postcode)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid postcode' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
  const addressLine =
    typeof parsed.addressLine === 'string' && parsed.addressLine.trim()
      ? parsed.addressLine.trim()
      : undefined;

  const result = await lookup(postcode, addressLine);
  return new Response(JSON.stringify(result), { headers: CORS_HEADERS });
});
