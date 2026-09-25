import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Estate agent organisation creation edge function (estate-agent portal phase 1).
 *
 * Auth posture: verify_jwt DISABLED at deploy level. The Supabase
 * edge runtime's runtime-level verify-jwt gateway only supports
 * HS256/RS256; the project's JWT signing key is ES256 so the gateway
 * returns UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM before any code
 * runs. Auth is instead enforced in code: we create an anon-key
 * client that forwards the caller's Authorization header and call
 * auth.getUser() — the GoTrue service verifies the ES256 signature
 * correctly. Deployed with `verify_jwt: false` — if re-deploying
 * manually via CLI, use `--no-verify-jwt`.
 *
 * Inputs (POST body):
 *   {
 *     name: string,
 *     branch: string,
 *     redress_scheme: 'PRS' | 'TPO',
 *     redress_number: string,
 *     companies_house_number?: string | null,
 *     companies_house_data?: CompaniesHouseCompany | null,
 *   }
 *
 * Companies House is optional for estate agents (many independents are
 * sole traders / partnerships) — when companies_house_number is empty or
 * omitted, verification is skipped entirely and the org is created
 * unverified.
 *
 * Output (200):
 *   { organisation: <full row> }
 *
 * Errors:
 *   401 unauthorized                          — invalid/missing JWT
 *   400 bad_request                           — input validation failed
 *   422 company_dissolved                     — CH says company is dissolved
 *   422 ch_mismatch                           — server-side CH lookup name mismatches client payload
 *   500 internal_error                        — anything else
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type, authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// UK company numbers: 8 digits OR 2-letter prefix + 6 digits
const UK_COMPANY_NUMBER_RE = /^([0-9]{8}|[A-Z]{2}[0-9]{6})$/;

const REDRESS_SCHEMES = ['PRS', 'TPO'] as const;
type RedressScheme = (typeof REDRESS_SCHEMES)[number];

interface CompaniesHouseCompany {
  companyNumber: string;
  name: string;
  status: string;
  incorporatedOn: string;
  address: Record<string, string | undefined>;
  isActive: boolean;
}

interface CreateOrgRequest {
  name?: string;
  branch?: string;
  redress_scheme?: string;
  redress_number?: string;
  companies_house_number?: string | null;
  companies_house_data?: CompaniesHouseCompany | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function normalizeCompanyNumber(input: string): string | null {
  const cleaned = input.trim().toUpperCase();
  if (!UK_COMPANY_NUMBER_RE.test(cleaned)) return null;
  return cleaned;
}

/**
 * Server-side Companies House re-verification. Calls the sibling
 * companies-house-lookup edge function via fetch to avoid duplicating the
 * upstream API key handling. Audit #47 (2026-05-11): switched from
 * SUPABASE_SERVICE_ROLE_KEY to SUPABASE_ANON_KEY — the lookup function is
 * deployed --no-verify-jwt and only needs project-level auth, so there's no
 * reason to send the service-role credential over the wire here.
 */
async function verifyCompanyServerSide(
  companyNumber: string,
): Promise<CompaniesHouseCompany | null> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!anonKey) {
    console.error('SUPABASE_ANON_KEY missing — cannot call companies-house-lookup');
    return null;
  }
  try {
    const url = `${SUPABASE_URL}/functions/v1/companies-house-lookup`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ companyNumber }),
    });
    if (!response.ok) return null;
    return (await response.json()) as CompaniesHouseCompany | null;
  } catch (err) {
    console.error('Server-side CH verification failed:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    return jsonResponse({ error: 'internal_error' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!SUPABASE_ANON_KEY) {
    console.error('SUPABASE_ANON_KEY is missing');
    return jsonResponse({ error: 'internal_error' }, 500);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    console.error('getUser failed:', userErr);
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const user = userData.user;

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let parsed: CreateOrgRequest;
  try {
    parsed = (await req.json()) as CreateOrgRequest;
  } catch {
    return jsonResponse({ error: 'bad_request', message: 'invalid JSON' }, 400);
  }

  const clientName = parsed.name?.trim() ?? '';
  const clientBranch = parsed.branch?.trim() ?? '';
  const clientRedressScheme = parsed.redress_scheme?.trim() ?? '';
  const clientRedressNumber = parsed.redress_number?.trim() ?? '';
  const rawNumber = parsed.companies_house_number?.trim() ?? '';
  const clientCh = parsed.companies_house_data ?? null;

  // Audit #47: cap clientName length so a 100 KB payload doesn't reach the
  // RPC. Companies House limits company names to 160 chars; allow 200 here
  // for headroom.
  if (clientName.length > 200) {
    return jsonResponse({ error: 'bad_request', message: 'name exceeds 200 chars' }, 400);
  }
  if (!clientName) {
    return jsonResponse({ error: 'bad_request', message: 'name required' }, 400);
  }

  if (clientBranch.length > 120) {
    return jsonResponse({ error: 'bad_request', message: 'branch exceeds 120 chars' }, 400);
  }
  if (!clientBranch) {
    return jsonResponse({ error: 'bad_request', message: 'branch required' }, 400);
  }

  if (!REDRESS_SCHEMES.includes(clientRedressScheme as RedressScheme)) {
    return jsonResponse(
      { error: 'bad_request', message: 'redress_scheme must be PRS or TPO' },
      400,
    );
  }

  if (clientRedressNumber.length > 40) {
    return jsonResponse({ error: 'bad_request', message: 'redress_number exceeds 40 chars' }, 400);
  }
  if (!clientRedressNumber) {
    return jsonResponse({ error: 'bad_request', message: 'redress_number required' }, 400);
  }

  // Companies House is optional for estate agents. Skip verification
  // entirely when no company number was supplied.
  let normalizedNumber: string | null = null;
  let verified = false;
  let snapshot: CompaniesHouseCompany | null = null;

  if (rawNumber) {
    normalizedNumber = normalizeCompanyNumber(rawNumber);
    if (!normalizedNumber) {
      return jsonResponse(
        { error: 'bad_request', message: 'invalid companies_house_number format' },
        400,
      );
    }

    const serverCh = await verifyCompanyServerSide(normalizedNumber);
    snapshot = clientCh;

    if (serverCh) {
      if (clientCh && clientCh.name !== serverCh.name) {
        return jsonResponse(
          { error: 'ch_mismatch', message: 'company name mismatch with Companies House' },
          422,
        );
      }
      if (!serverCh.isActive) {
        return jsonResponse(
          { error: 'company_dissolved', message: 'company is not active on Companies House' },
          422,
        );
      }
      verified = true;
      snapshot = serverCh;
    }
  }

  const { data: orgRow, error: rpcErr } = await serviceClient.rpc(
    'create_estate_agent_org_atomic',
    {
      p_user_id: user.id,
      p_name: clientName,
      p_branch: clientBranch,
      p_redress_scheme: clientRedressScheme,
      p_redress_number: clientRedressNumber,
      p_companies_house_number: normalizedNumber ?? null,
      p_companies_house_verified: verified,
      p_ch_snapshot: snapshot as unknown as Record<string, unknown> | null,
    },
  );

  if (rpcErr) {
    console.error(`create_estate_agent_org_atomic RPC failed for user ${user.id}:`, rpcErr);
    return jsonResponse({ error: 'internal_error' }, 500);
  }

  return jsonResponse({ organisation: orgRow }, 200);
});
