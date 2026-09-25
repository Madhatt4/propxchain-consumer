import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Agreed with Optimus/Landmark (2026-07-23): referrals are an
// HTML table in the email body, subject EXACTLY "PropXchain survey referral",
// to the sales inbox below. Field names in the table must match theirs
// verbatim (including the odd-cased "PropertyAddressCity"). Interim channel
// until their surveys API lands (~end of 2026). Env-overridable so a staging
// deploy can point elsewhere without a code change.
const OPTIMUS_REFERRAL_TO =
  Deno.env.get('OPTIMUS_REFERRAL_TO') || 'optimussurveysales@optimus-move.co.uk';
const REFERRAL_SUBJECT = 'PropXchain survey referral';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 3;

interface ReferralRequest {
  transactionId: string;
  customerFirstName: string;
  customerLastName?: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddressLine1: string;
  propertyAddressLine2?: string;
  propertyAddressCity?: string;
  propertyAddressPostcode: string;
  propertyValue: number;
  uprn?: string;
}

function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tableRow(field: string, value: string): string {
  const td = 'padding:6px 12px;border:1px solid #000;font-family:Calibri,Arial,sans-serif;font-size:14px;';
  return `<tr><td style="${td}">${field}</td><td style="${td}">${escapeHtml(value)}</td></tr>`;
}

function buildReferralHtml(r: ReferralRequest): string {
  // Row set corrected per Optimus 2026-07-24: customerLastName is its
  // own row (was missing from the original spec). Their automation parses
  // these rows — don't merge, reorder, or rename them.
  const rows = [
    tableRow('customerFirstName', r.customerFirstName),
    tableRow('customerLastName', r.customerLastName ?? ''),
    tableRow('customerEmail', r.customerEmail),
    tableRow('customerPhone', r.customerPhone),
    tableRow('propertyAddressLine1', r.propertyAddressLine1),
    tableRow('propertyAddressLine2', r.propertyAddressLine2 ?? ''),
    tableRow('PropertyAddressCity', r.propertyAddressCity ?? ''),
    tableRow('propertyAddressPostcode', r.propertyAddressPostcode),
    tableRow('propertyValue', String(r.propertyValue)),
    // Extra row beyond Optimus's list — offered 2026-07-24, useful for exact
    // property matching and their upcoming surveys API. Appended last so
    // their row-parsing automation sees the agreed rows in the agreed order.
    tableRow('uprn', r.uprn ?? ''),
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${REFERRAL_SUBJECT}</title></head>
<body style="margin:0;padding:16px;font-family:Calibri,Arial,sans-serif;">
  <p style="font-size:14px;margin:0 0 12px;">Survey referral from PropXchain:</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
  <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">
    Sent by PropXchain Ltd. Queries: support@propxchain.com
  </p>
</body>
</html>`;
}

async function sendEmail(html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PropXchain <noreply@propxchain.com>',
        to: [OPTIMUS_REFERRAL_TO],
        subject: REFERRAL_SUBJECT,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Origin-allowlisted rather than '*' (audit 2026-07-25, finding #10).
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
  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing env vars' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  // Auth in code (not runtime verify_jwt): project JWT key is ES256 which the
  // gateway can't verify — same pattern as request-conveyancer-quotes.
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
    key: `optimus-survey-referral:user:${userData.user.id}`,
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

  let body: ReferralRequest;
  try {
    body = (await req.json()) as ReferralRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const missing = (
    ['transactionId', 'customerFirstName', 'customerEmail', 'customerPhone', 'propertyAddressLine1', 'propertyAddressPostcode'] as const
  ).filter((k) => !body[k] || typeof body[k] !== 'string');
  if (missing.length || typeof body.propertyValue !== 'number' || !(body.propertyValue > 0)) {
    return new Response(
      JSON.stringify({ error: `Missing/invalid fields: ${[...missing, ...(typeof body.propertyValue === 'number' && body.propertyValue > 0 ? [] : ['propertyValue'])].join(', ')}` }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Anti-IDOR: the referred customer must be the authenticated caller. The
  // buyer refers themself — this endpoint must never let an authed user
  // ship someone else's contact details to a third party.
  const callerEmail = userData.user.email?.toLowerCase().trim();
  if (!callerEmail || callerEmail !== body.customerEmail.toLowerCase().trim()) {
    return new Response(
      JSON.stringify({ error: 'forbidden', message: 'customerEmail must match the authenticated user' }),
      { status: 403, headers: CORS_HEADERS },
    );
  }

  // Record first (referral-fee reconciliation trail), then send.
  const { data: inserted, error: insertError } = await supabase
    .from('survey_referrals')
    .insert({
      transaction_id: body.transactionId,
      user_id: userData.user.id,
      provider_id: 'optimus',
      customer_first_name: body.customerFirstName,
      customer_last_name: body.customerLastName ?? null,
      customer_email: body.customerEmail,
      customer_phone: body.customerPhone,
      address_line1: body.propertyAddressLine1,
      address_line2: body.propertyAddressLine2 ?? null,
      city: body.propertyAddressCity ?? null,
      postcode: body.propertyAddressPostcode,
      property_value: body.propertyValue,
      uprn: body.uprn ?? null,
      email_sent: false,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return new Response(
      JSON.stringify({ error: 'Failed to record referral', detail: insertError?.message }),
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const emailSent = await sendEmail(buildReferralHtml(body));
  if (emailSent) {
    await supabase.from('survey_referrals').update({ email_sent: true }).eq('id', inserted.id);
  }

  return new Response(JSON.stringify({ success: emailSent, referralId: inserted.id, emailSent }), {
    status: emailSent ? 200 : 502,
    headers: CORS_HEADERS,
  });
});
