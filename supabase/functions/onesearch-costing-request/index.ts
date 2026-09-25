import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// OneSearch's full PISCES catalogue has no per-product trade price, so
// products picked outside a pack can't be ordered and paid for -- they go out
// as a costing request instead. Per OneSearch (2026-07-28): tell them when a
// customer picks a product outside a pack and they sort the trade cost from
// there. This email IS that signal; the search_orders row alone reached nobody.
//
// PropXchain is cc'd and is also the Reply-To -- OneSearch replies to
// PropXchain, never to the customer, because the customer relationship is ours.
//
// The recipients are named people at a supplier, so they live only in the
// ONESEARCH_COSTING_TO secret, never in source. Without it the function
// refuses to run rather than send the request nowhere.
const COSTING_TO = (Deno.env.get('ONESEARCH_COSTING_TO') || '')
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);
const COSTING_CC = (Deno.env.get('ONESEARCH_COSTING_CC') || 'marc@propxchain.com')
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);
const COSTING_REPLY_TO = Deno.env.get('ONESEARCH_COSTING_REPLY_TO') || 'marc@propxchain.com';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 5;

interface CostingRequestBody {
  orderId: string;
}

/** The subset of a search_orders row this function reads. */
interface SearchOrderRow {
  id: string;
  transaction_id: string;
  provider: string;
  package_type: string;
  searches: Array<{ name?: string; productType?: string }>;
  postcode: string;
  local_authority: string | null;
  ordered_by: string;
  created_at: string;
  notified_at: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCostingHtml(order: SearchOrderRow): string {
  const td = 'padding:6px 12px;border:1px solid #d1d5db;font-family:Calibri,Arial,sans-serif;font-size:14px;';
  const th = `${td}background:#f3f4f6;font-weight:600;`;

  const productRows = order.searches
    .map(
      (s) =>
        `<tr><td style="${td}">${escapeHtml(s.productType ?? '')}</td><td style="${td}">${escapeHtml(s.name ?? '')}</td></tr>`,
    )
    .join('');

  const detail = (label: string, value: string): string =>
    `<tr><td style="${th}">${label}</td><td style="${td}">${escapeHtml(value)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>PropXchain costing request</title></head>
<body style="margin:0;padding:16px;font-family:Calibri,Arial,sans-serif;color:#111827;">
  <p style="font-size:14px;margin:0 0 12px;">
    A PropXchain customer has selected OneSearch products that fall outside the
    Standard / Refresh / Premium packs. These have no agreed trade price yet, so
    this is a request for costing rather than an order.
  </p>

  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
    ${detail('PropXchain reference', order.id)}
    ${detail('Transaction', order.transaction_id)}
    ${detail('Postcode', order.postcode)}
    ${detail('Local authority', order.local_authority ?? 'Not identified')}
    ${detail('Requested by', order.ordered_by)}
    ${detail('Requested at', order.created_at)}
  </table>

  <p style="font-size:14px;margin:0 0 8px;font-weight:600;">Products requested (${order.searches.length}):</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td style="${th}">PISCES code</td><td style="${th}">Product</td></tr>
    ${productRows}
  </table>

  <p style="font-size:14px;margin:16px 0 0;">
    Please reply with trade pricing for these codes. We have told the customer
    OneSearch will confirm exact pricing within 24 hours. Reply to this email and
    it reaches PropXchain &mdash; we handle the customer from there.
  </p>
  <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">
    Sent automatically by PropXchain Ltd. Queries: ${escapeHtml(COSTING_REPLY_TO)}
  </p>
</body>
</html>`;
}

async function sendEmail(order: SearchOrderRow): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PropXchain <noreply@propxchain.com>',
        to: COSTING_TO,
        cc: COSTING_CC,
        reply_to: COSTING_REPLY_TO,
        // Postcode in the subject so OneSearch can eyeball which property a
        // request is about without opening it.
        subject: `PropXchain costing request — ${order.postcode}`,
        html: buildCostingHtml(order),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }
  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || COSTING_TO.length === 0) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing env vars' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  // Auth in code (not runtime verify_jwt): the project JWT key is ES256, which
  // the gateway can't verify — same pattern as optimus-survey-referral.
  // Deploy with --no-verify-jwt.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const rl = await checkRateLimit({
    key: `onesearch-costing-request:user:${userData.user.id}`,
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    supabaseAdmin: supabase,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', resetIn: rl.retryAfter }),
      { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let body: CostingRequestBody;
  try {
    body = (await req.json()) as CostingRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
  if (!body.orderId || typeof body.orderId !== 'string' || !UUID_RE.test(body.orderId)) {
    return new Response(JSON.stringify({ error: 'Missing/invalid field: orderId' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // The email is built entirely from the stored row, never from the request
  // body. The caller can only name an order; it cannot dictate what we tell a
  // supplier, so a compromised or hostile client can't post arbitrary content
  // to OneSearch under our name. It may only name its OWN order: the service
  // role bypasses RLS, so without the user_id match any account could send the
  // supplier someone else's basket (security scan L3). Someone else's order
  // reads as not found, so the reply confirms nothing about it.
  const { data: order, error: orderErr } = await supabase
    .from('search_orders')
    .select(
      'id, transaction_id, provider, package_type, searches, postcode, local_authority, ordered_by, created_at, notified_at',
    )
    .eq('id', body.orderId)
    .eq('user_id', userData.user.id)
    .maybeSingle<SearchOrderRow>();

  if (orderErr) {
    return new Response(
      JSON.stringify({ error: 'lookup_failed', detail: orderErr.message }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
  if (!order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  }
  if (order.provider !== 'onesearch' || order.package_type !== 'lineItem') {
    return new Response(
      JSON.stringify({ error: 'not_a_costing_request' }),
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (!Array.isArray(order.searches) || order.searches.length === 0) {
    return new Response(JSON.stringify({ error: 'order_has_no_products' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // Idempotent: a retry, a double-click, or a replayed request must not email
  // the supplier about the same basket twice.
  if (order.notified_at) {
    return new Response(
      JSON.stringify({ success: true, alreadyNotified: true, notifiedAt: order.notified_at }),
      { status: 200, headers: CORS_HEADERS },
    );
  }

  const emailSent = await sendEmail(order);
  if (!emailSent) {
    // notified_at stays null, so this request is still visible as outstanding
    // via search_orders_pending_notification_idx and can be retried.
    return new Response(JSON.stringify({ error: 'email_send_failed' }), {
      status: 502,
      headers: CORS_HEADERS,
    });
  }

  const { error: stampErr } = await supabase
    .from('search_orders')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', order.id);

  // The email is out — that's the thing that matters, so this is a success
  // even if the stamp failed. Flagged in the response so a failure to record
  // it is visible rather than silent; worst case the request looks
  // outstanding and someone chases a costing OneSearch already has.
  return new Response(
    JSON.stringify({ success: true, orderId: order.id, stamped: !stampErr }),
    { status: 200, headers: CORS_HEADERS },
  );
});
