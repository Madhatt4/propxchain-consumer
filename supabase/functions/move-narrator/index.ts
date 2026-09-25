import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { bearerMatches } from '../_shared/bearer-secret.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { emitTelemetry } from '../_shared/telemetry.ts';
import { fetchNarrationOutputs, fireNarration, getSessionStatus, isSettled } from './narrator.ts';
import { deliverNarration, recipientFromUser } from './delivery.ts';
import { ValidationError, validateMonitorFireRequest, validateRequest } from './validate.ts';
import { runMonitorFire } from './monitor.ts';
import { verifiedTxId } from './txid.ts';

/**
 * move-narrator edge function — server-side trigger + delivery for the
 * PropXchain Move Narrator Claude Managed Agent.
 *
 * The frontend calls this when a transaction's blocker changes.
 * ANTHROPIC_API_KEY and the delivery provider keys never leave the server.
 *
 *   fire    { transaction, getNextStep }   → { sessionId }   (start a graded run)
 *   status  { sessionId, txId? }           → { status, verdict }
 *   deliver { sessionId, txId? }           → { notification, results }
 *           (notification is for the client to render in the in-app feed;
 *            email + SMS go to the AUTHENTICATED CALLER — see below)
 *
 * TELEMETRY (chunk 1, agentic layer): every action emits fire-and-forget rows
 * to `transaction_telemetry` via `../_shared/telemetry.ts` — `blocker_changed`
 * + `narrator_fired` on `fire`, `narrator_verdict` once a run settles (checked
 * on `status`, not on every poll), `narrator_delivered` on `deliver`. Payloads
 * are enum/id fields only — never the drafted notification/email/SMS text, an
 * address, or the property address. `txId` on `status`/`deliver` never
 * changes response behaviour — it only decides which transaction the
 * `narrator_verdict`/`narrator_delivered` emit gets attributed to, and even
 * that is now verified server-side (chunk 2, see `txid.ts`): the recorded
 * `narrator_fired` row wins whenever one exists, the client's value is only a
 * fallback for pre-telemetry sessions. A telemetry failure never fails the
 * request — see emitTelemetry's own try/catch.
 *
 * `monitor_fire` (chunk 2) is a separate, Bearer-secret-gated action for the
 * transaction-monitor cron — routed before any of the above, see the block
 * near the top of the handler and monitor.ts's own header.
 *
 * Auth posture: deployed --no-verify-jwt because the project's JWT signing key
 * is ES256, which the runtime gateway cannot verify. Auth is therefore enforced
 * in code, the same pattern as create-developer-org and
 * optimus-survey-referral: forward the caller's Authorization header to an
 * anon-key client and let GoTrue verify the signature via auth.getUser().
 *
 * SECURITY (audit 2026-07-25, finding #2): this function previously performed
 * no authentication at all and took the delivery recipient straight from the
 * request body. That made it an open relay — anyone could send attacker-chosen
 * email through the RESEND_FROM domain and SMS through the TWILIO_FROM_NUMBER,
 * with PropXchain's own SPF/DKIM behind it, and could burn ANTHROPIC_API_KEY
 * credit without limit. Two fixes, both required:
 *   1. every action needs a verified Supabase session, rate-limited per user;
 *   2. `deliver` ignores any body-supplied recipient and sends only to the
 *      authenticated user's own registered email/phone, so the caller can
 *      never choose the destination.
 *
 * Secrets (Supabase function secrets — never in source):
 *   ANTHROPIC_API_KEY · MOVE_NARRATOR_AGENT_ID · MOVE_NARRATOR_ENV_ID
 *   TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_FROM_NUMBER  (SMS, optional)
 *   RESEND_API_KEY · RESEND_FROM                                 (email, optional)
 *   MONITOR_NARRATOR_SECRET                    (monitor_fire only, required for it)
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// 'fire' starts a billed Anthropic agent run and 'deliver' sends email/SMS, so
// the cap is deliberately tight. A real mover sees a handful of blocker
// changes across a whole transaction, not dozens per hour.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function config(): { apiKey: string; agentId: string; envId: string } {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const agentId = Deno.env.get('MOVE_NARRATOR_AGENT_ID') ?? '';
  const envId = Deno.env.get('MOVE_NARRATOR_ENV_ID') ?? '';
  if (!apiKey || !agentId || !envId) {
    throw new Error('server not configured: set ANTHROPIC_API_KEY, MOVE_NARRATOR_AGENT_ID, MOVE_NARRATOR_ENV_ID');
  }
  return { apiKey, agentId, envId };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Circuit breaker, not a security boundary — the Bearer-secret compare is.
// The monitor sweeps every live transaction on a daily cron and may cross the
// nudge threshold for many at once; this cap just stops a runaway/looping
// caller from burning the Anthropic budget and provider sends unbounded.
const MONITOR_RATE_LIMIT_MAX = 100;
const MONITOR_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY missing');
    return json(req, { error: 'server not configured' }, 500);
  }

  // Parsed once, up front, so the `monitor_fire` action can be routed to its
  // own Bearer-secret path BEFORE the user-JWT auth below ever runs.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json(req, { error: 'invalid JSON body' }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- monitor_fire: Bearer-secret path, no end-user session --------------
  // See task-5-report.md for the roster/premium-entitlement investigation.
  if (isRecord(rawBody) && rawBody.action === 'monitor_fire') {
    // Fail-closed BEFORE the compare: if the secret were empty, comparing
    // against `Bearer ${''}` would match a bare "Bearer " header sent by an
    // attacker who simply omits a token.
    const monitorSecret = Deno.env.get('MONITOR_NARRATOR_SECRET') ?? '';
    if (!monitorSecret) {
      console.error('MONITOR_NARRATOR_SECRET not set');
      return json(req, { error: 'server not configured' }, 503);
    }
    if (!(await bearerMatches(req, monitorSecret))) {
      return json(req, { error: 'unauthorized' }, 401);
    }

    // Not a security control (the compare above is) — a circuit breaker, see
    // MONITOR_RATE_LIMIT_MAX's comment.
    const rl = await checkRateLimit({
      key: 'move-narrator:monitor',
      limit: MONITOR_RATE_LIMIT_MAX,
      windowSeconds: MONITOR_RATE_LIMIT_WINDOW_SECONDS,
      supabaseAdmin: adminClient,
    });
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', resetIn: rl.retryAfter }),
        { status: 429, headers: { ...corsHeaders(req), 'Retry-After': String(rl.retryAfter) } },
      );
    }

    let monitorRequest;
    try {
      monitorRequest = validateMonitorFireRequest(rawBody);
    } catch (err) {
      const msg = err instanceof ValidationError ? err.message : 'invalid request';
      return json(req, { error: msg }, 400);
    }

    try {
      const { apiKey, agentId, envId } = config();
      const result = await runMonitorFire(adminClient, { apiKey, agentId, envId }, monitorRequest);
      // Full result shape: `skipped` only when present
      // (the premium roster exceeded the per-invocation cap) — additive, so
      // the monorepo caller reading only `.fired` is unaffected either way.
      const responseBody = result.skipped !== undefined
        ? { fired: result.fired, skipped: result.skipped }
        : { fired: result.fired };
      return json(req, responseBody);
    } catch (err) {
      console.error('monitor_fire failed:', err);
      return json(req, { error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  // --- authenticate (user-JWT path: fire/status/deliver) -------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(req, { error: 'unauthorized' }, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(req, { error: 'unauthorized' }, 401);
  }
  const user = userData.user;

  // --- rate limit (per user, Postgres-backed so it survives cold starts) ---
  const rl = await checkRateLimit({
    key: `move-narrator:user:${user.id}`,
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    supabaseAdmin: adminClient,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', resetIn: rl.retryAfter }),
      { status: 429, headers: { ...corsHeaders(req), 'Retry-After': String(rl.retryAfter) } },
    );
  }

  // --- validate -----------------------------------------------------------
  let request;
  try {
    request = validateRequest(rawBody);
  } catch (err) {
    const msg = err instanceof ValidationError ? err.message : 'invalid JSON body';
    return json(req, { error: msg }, 400);
  }

  // --- act ----------------------------------------------------------------
  try {
    const { apiKey, agentId, envId } = config();
    switch (request.action) {
      case 'fire': {
        const { transaction, getNextStep } = request;
        const sessionId = await fireNarration(apiKey, agentId, envId, transaction, getNextStep);
        // blocker transition observed server-side (authoritative next_step state came in the request)
        await emitTelemetry(adminClient, {
          transactionId: transaction.txId,
          eventType: 'blocker_changed',
          source: 'narrator',
          dedupeKey: `${transaction.previousBlocker}->${getNextStep.blocker}:${sessionId}`,
          payload: {
            previousBlocker: transaction.previousBlocker,
            blocker: getNextStep.blocker,
            urgency: getNextStep.urgency,
            role: transaction.role,
          },
        });
        await emitTelemetry(adminClient, {
          transactionId: transaction.txId,
          eventType: 'narrator_fired',
          source: 'narrator',
          dedupeKey: `fired:${sessionId}`,
          payload: { blocker: getNextStep.blocker },
        });
        return json(req, { sessionId });
      }
      case 'status': {
        const result = await getSessionStatus(apiKey, request.sessionId);
        // Emit once the run has genuinely settled (idle + a terminal verdict, not
        // the transient 'pending' a just-fired session reports for a few seconds)
        // — never on every intermediate poll. dedupeKey makes a second settled
        // poll (e.g. a retried request) a harmless no-op insert.
        if (isSettled(result)) {
          // Chunk 2 precondition #1: txId was client-supplied and unverified.
          // The narrator_fired row recorded at fire-time is authoritative —
          // prefer it whenever one exists, even over an omitted/disagreeing
          // client value; fall back to the client's only for pre-telemetry
          // sessions with no recorded row.
          const txId = await verifiedTxId(adminClient, request.sessionId, request.txId);
          if (txId) {
            await emitTelemetry(adminClient, {
              transactionId: txId,
              eventType: 'narrator_verdict',
              source: 'narrator',
              dedupeKey: `verdict:${request.sessionId}`,
              payload: { verdict: result.verdict }, // 'satisfied' | 'unsatisfied' — enum only, never the drafted text
            });
          }
        }
        return json(req, result);
      }
      case 'deliver': {
        const outputs = await fetchNarrationOutputs(apiKey, request.sessionId);
        // Recipient comes from the verified session, never the request body.
        const results = await deliverNarration(outputs, recipientFromUser(user));
        // See the 'status' case above for why the recorded value wins.
        const txId = await verifiedTxId(adminClient, request.sessionId, request.txId);
        if (txId) {
          await emitTelemetry(adminClient, {
            transactionId: txId,
            eventType: 'narrator_delivered',
            source: 'narrator',
            dedupeKey: `delivered:${request.sessionId}`,
            payload: {
              channels: results.map((c) => ({ channel: c.channel, status: c.status })),
            }, // channel + status enums only — no addresses, no message text
          });
        }
        return json(req, { notification: outputs.notification, results });
      }
    }
  } catch (err) {
    console.error('move-narrator failed:', err);
    return json(req, { error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
