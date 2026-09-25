// supabase/functions/_shared/cors.ts
//
// Origin-allowlisted CORS for the edge functions.
//
// These functions previously replied `Access-Control-Allow-Origin: *`, which
// let any page on the internet drive them from a victim's browser. They read
// their bearer from an explicit Authorization header rather than a cookie, so
// the wildcard was not itself a session-theft path — but it removed any origin
// restriction from endpoints that spend money (Anthropic, Twilio, Resend, the
// MHCLG EPC quota). Authentication is the real control; this is defence in depth.
//
// Extra origins can be added at deploy time without a code change:
//   supabase secrets set EXTRA_ALLOWED_ORIGINS="https://staging.example.com,https://foo.dev"

const DEFAULT_ALLOWED_ORIGINS = [
  'https://propxchain.com',
  'https://www.propxchain.com',
  // ICP asset canisters serving the same SPA.
  'https://lzpic-oaaaa-aaaaa-qcwva-cai.icp0.io',
  'https://u4idr-jyaaa-aaaab-qco5q-cai.icp0.io',
  // Local dev (Vite).
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

function allowedOrigins(): string[] {
  const extra = (Deno.env.get('EXTRA_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

/**
 * Build CORS headers for this request.
 *
 * An unrecognised or absent Origin gets no Allow-Origin header at all, so the
 * browser blocks the response. Non-browser callers (curl, server-to-server) are
 * unaffected — CORS is enforced by the browser, never by us, which is exactly
 * why authentication and not this function is the security boundary.
 *
 * `Vary: Origin` is required so shared caches never serve one origin's
 * Allow-Origin header to another.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

/** Standard preflight reply. */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
