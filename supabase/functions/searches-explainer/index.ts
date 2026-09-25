import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { corsHeaders, preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { generateNarration } from './explainer.ts';
import type { ExplainerRequest } from './types.ts';

/**
 * searches-explainer — plain-English narration of one property's search
 * requirements, cached by area profile.
 *
 * The deterministic engine (src/utils/searchRegionMapping.ts) owns every fact
 * the card shows. This function only rewrites the opening paragraphs, so a
 * null response is normal and never an error the customer sees.
 *
 * SECURITY: this function holds OPENROUTER_API_KEY. move-narrator's audit
 * finding #2 (2026-07-25) was an unauthenticated function with the same key,
 * which let anyone burn API credit without limit. Every request here needs a
 * verified session and passes a per-user rate limit — INCLUDING cache hits, so
 * the cache cannot become an unauthenticated read of stored content.
 *
 * The model, the rubric and the prompt are fixed in source. Nothing about the
 * Claude call is taken from the request body.
 *
 * Auth posture: deployed --no-verify-jwt because the project's JWT signing key
 * is ES256, which the runtime gateway cannot verify. Auth is enforced in code,
 * the same pattern as move-narrator and optimus-survey-referral.
 *
 * Secrets (Supabase function secrets — never in source):
 *   OPENROUTER_API_KEY
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';

// Generous relative to move-narrator's 20/hr: this is a read on a page people
// revisit while waiting on results, and the cache absorbs nearly all of it.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(req, { error: 'unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(req, { error: 'unauthorized' }, 401);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rl = await checkRateLimit({
    key: `searches-explainer:user:${userData.user.id}`,
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    supabaseAdmin: adminClient,
  });
  if (!rl.allowed) {
    return json(req, { error: 'rate_limited', resetIn: rl.retryAfter }, 429);
  }

  let body: ExplainerRequest;
  try {
    body = (await req.json()) as ExplainerRequest;
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }
  if (!body?.cacheKey || !body?.analysis) {
    return json(req, { error: 'invalid_request' }, 400);
  }

  const { data: cached } = await adminClient
    .from('searches_explainer_cache')
    .select('narration')
    .eq('cache_key', body.cacheKey)
    .maybeSingle();

  if (cached?.narration) {
    return json(req, { narration: cached.narration });
  }

  if (!OPENROUTER_API_KEY) {
    // Not configured is not an error for the caller: the card is already
    // complete without narration.
    return json(req, { narration: null });
  }

  let narration: string[] | null = null;
  try {
    narration = await generateNarration(OPENROUTER_API_KEY, body.analysis);
  } catch {
    return json(req, { narration: null });
  }

  if (narration) {
    await adminClient
      .from('searches_explainer_cache')
      .upsert({ cache_key: body.cacheKey, narration }, { onConflict: 'cache_key' });
  }

  return json(req, { narration });
});
