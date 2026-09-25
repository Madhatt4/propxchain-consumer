import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { readChainInvite } from '../_shared/chain-invite.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 10;

const ALLOWED_ROLES = [
  'seller',
  'buyer',
  'conveyancer',
  'mortgage_broker',
  'lender',
  'other',
  'estate_agent',
] as const;
type Role = (typeof ALLOWED_ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// invite_code and property_address may still arrive from older clients; they
// are ignored. Both are read from the deal on-chain (security scan M13).
interface PartyInviteRequest {
  transaction_id: string;
  role: Role;
  side?: 'buyer' | 'seller';
  recipient_name: string;
  recipient_email: string;
  listing_id: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildInviteHtml(opts: {
  recipientName: string;
  propertyAddress: string;
  joinLink: string;
  senderLine: string;
}): string {
  const { recipientName, propertyAddress, joinLink, senderLine } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>You've been invited to PropXchain</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'DM Sans',Georgia,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#0D9488;padding:20px 32px;">
              <span style="font-family:Georgia,serif;font-size:20px;color:#ffffff;letter-spacing:0.5px;">PropXchain</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${escapeHtml(recipientName)},</p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.5;">
                ${escapeHtml(senderLine)} has invited you to your property sale on PropXchain for:
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#111827;font-weight:bold;">
                ${escapeHtml(propertyAddress)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background:#0D9488;">
                    <a href="${joinLink}" style="display:inline-block;padding:12px 28px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Open my sale</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                Or copy this link into your browser:<br />
                <a href="${joinLink}" style="color:#0D9488;word-break:break-all;">${joinLink}</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
                Create your free PropXchain account to open your sale — it takes a minute.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PropXchain <noreply@propxchain.com>',
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Origin-allowlisted rather than '*' (see _shared/cors.ts).
  if (req.method === 'OPTIONS') {
    return preflight(req);
  }
  const CORS_HEADERS = corsHeaders(req);

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
  // gateway can't verify — same pattern as optimus-survey-referral.
  // Deploy with verify_jwt: false.
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
    key: `send-party-invite:user:${userData.user.id}`,
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

  let body: PartyInviteRequest;
  try {
    body = (await req.json()) as PartyInviteRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request', message: 'Invalid JSON body' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (
    typeof body.transaction_id !== 'string' ||
    !body.transaction_id ||
    typeof body.role !== 'string' ||
    !ALLOWED_ROLES.includes(body.role) ||
    (body.side !== undefined && body.side !== 'buyer' && body.side !== 'seller') ||
    typeof body.recipient_name !== 'string' ||
    body.recipient_name.length < 1 ||
    body.recipient_name.length > 120 ||
    typeof body.recipient_email !== 'string' ||
    !EMAIL_RE.test(body.recipient_email) ||
    typeof body.listing_id !== 'string' ||
    !body.listing_id
  ) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // Authorisation: the caller must be a member of the organisation that owns
  // `listing_id`, AND that listing must already be linked to this
  // transaction. This is the ONLY thing the decision rests on — never a
  // client-writable row. `transaction_party_roles` is written by the public
  // `recordMyRole` RPC, so a row there (even with role='estate_agent') can be
  // self-granted by anyone and must never gate authorisation on its own.
  const { data: listingRow, error: listingErr } = await supabase
    .from('agent_listings')
    .select('organisation_id')
    .eq('id', body.listing_id)
    .eq('transaction_id', body.transaction_id)
    .maybeSingle();

  if (listingErr || !listingRow) {
    return new Response(JSON.stringify({ error: 'not_authorised' }), {
      status: 403,
      headers: CORS_HEADERS,
    });
  }

  const { data: membership, error: membershipErr } = await supabase
    .from('organisation_memberships')
    .select('organisation_id')
    .eq('user_id', userData.user.id)
    .eq('organisation_id', listingRow.organisation_id as string)
    .maybeSingle();

  if (membershipErr || !membership) {
    return new Response(JSON.stringify({ error: 'not_authorised' }), {
      status: 403,
      headers: CORS_HEADERS,
    });
  }

  // Belt-and-braces: reject if this transaction_id is ALSO linked to a
  // different agent_listings row. `agent_listings_transaction_id_uidx` (a
  // partial unique index on transaction_id) makes this impossible at the
  // data layer, but this explicit check documents the invariant the
  // authorisation above depends on and fails cleanly rather than silently
  // trusting a single linkage row if that index is ever dropped.
  const { data: otherLinkedListings, error: otherLinkedErr } = await supabase
    .from('agent_listings')
    .select('id')
    .eq('transaction_id', body.transaction_id)
    .neq('id', body.listing_id);

  if (otherLinkedErr) {
    return new Response(JSON.stringify({ error: 'not_authorised' }), {
      status: 403,
      headers: CORS_HEADERS,
    });
  }
  if (otherLinkedListings && otherLinkedListings.length > 0) {
    return new Response(JSON.stringify({ error: 'transaction_already_linked' }), {
      status: 409,
      headers: CORS_HEADERS,
    });
  }

  // M13: the code in the join link and the address in the email are the
  // deal's own, read on-chain, so an agent cannot point a branded invite at
  // another deal or a made-up address.
  const chainInvite = await readChainInvite(body.transaction_id);
  if (!chainInvite.ok) {
    return new Response(JSON.stringify({ error: chainInvite.error }), {
      status: chainInvite.status,
      headers: CORS_HEADERS,
    });
  }
  const { inviteCode, propertyAddress } = chainInvite.invite;

  // Display principal only — never part of the authorisation decision above.
  // Falls back to the empty string (rather than failing the request) if the
  // caller has no transaction_party_roles row yet, e.g. a colleague sending
  // on behalf of the org before they've recorded their own role.
  const { data: partyRole } = await supabase
    .from('transaction_party_roles')
    .select('principal')
    .eq('transaction_id', body.transaction_id)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  const invitedByPrincipal = (partyRole?.principal as string | undefined) ?? '';

  const { data: inserted, error: insertError } = await supabase
    .from('party_invites')
    .insert({
      transaction_id: body.transaction_id,
      invite_code: inviteCode,
      listing_id: body.listing_id ?? null,
      role: body.role,
      side: body.side ?? null,
      recipient_name: body.recipient_name,
      recipient_email: body.recipient_email,
      invited_by_principal: invitedByPrincipal,
      invited_by_user_id: userData.user.id,
      email_sent: false,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return new Response(
      JSON.stringify({ error: 'bad_request', detail: insertError?.message }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const joinLink = `https://propxchain.com/join/${encodeURIComponent(inviteCode)}?role=${body.role}&side=${body.side ?? ''}&by=${invitedByPrincipal}`;

  const senderLine = 'Your estate agent';
  const html = buildInviteHtml({
    recipientName: body.recipient_name,
    propertyAddress,
    joinLink,
    senderLine,
  });

  const emailSent = await sendEmail({
    to: body.recipient_email,
    subject: `${senderLine} has invited you to your property sale on PropXchain`,
    html,
  });

  if (!emailSent) {
    return new Response(
      JSON.stringify({ error: 'email_failed', invite_id: inserted.id }),
      { status: 502, headers: CORS_HEADERS },
    );
  }

  await supabase.from('party_invites').update({ email_sent: true }).eq('id', inserted.id);

  return new Response(JSON.stringify({ ok: true, invite_id: inserted.id }), {
    status: 200,
    headers: CORS_HEADERS,
  });
});
