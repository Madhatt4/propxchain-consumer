// Email the buyer a developer has just reserved a plot for (step 4 of the
// reservation saga, reservation.service).
//
// Everything in the email is read here, with the service role, from the plot
// row the caller's organisation owns: the buyer's address (reserved_for_email),
// the plot's invite code, and the plot, site and developer names. The browser
// only names the plot and the buyer's first name, so a developer can't use
// this to mail an arbitrary address or a code that isn't theirs.
//
// The outcome is recorded on plots.email_failed so the dashboard can say the
// buyer was never told.
//
// Deploy with verify_jwt: false (auth is checked in code; see send-party-invite).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PlotInviteRequest {
  plot_id: string;
  buyer_name?: string;
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
  buyerName: string;
  developerName: string;
  plotLine: string;
  siteAddress: string;
  buyerEmail: string;
  inviteCode: string;
  joinLink: string;
}): string {
  const { buyerName, developerName, plotLine, siteAddress, buyerEmail, inviteCode, joinLink } = opts;
  const greeting = buyerName ? `Hi ${escapeHtml(buyerName)},` : 'Hello,';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Your plot is reserved</title></head>
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
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">${greeting}</p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.5;">
                ${escapeHtml(developerName)} has reserved this home for you:
              </p>
              <p style="margin:0 0 4px;font-size:15px;color:#111827;font-weight:bold;">${escapeHtml(plotLine)}</p>
              ${siteAddress ? `<p style="margin:0 0 24px;font-size:14px;color:#374151;">${escapeHtml(siteAddress)}</p>` : '<p style="margin:0 0 24px;"></p>'}
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background:#0D9488;">
                    <a href="${joinLink}" style="display:inline-block;padding:12px 28px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Take my reservation</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:14px;color:#374151;line-height:1.5;">
                Sign in with <strong>${escapeHtml(buyerEmail)}</strong>. The plot is held for that email address only.
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                Your code is <strong style="font-family:monospace;color:#111827;">${escapeHtml(inviteCode)}</strong>.
                If the button doesn't work, copy this link into your browser:<br />
                <a href="${joinLink}" style="color:#0D9488;word-break:break-all;">${joinLink}</a>
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

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
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

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflight(req);
  }
  const CORS_HEADERS = corsHeaders(req);

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, CORS_HEADERS);
  }
  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: 'Server misconfiguration: missing env vars' }, 500, CORS_HEADERS);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401, CORS_HEADERS);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'unauthorized' }, 401, CORS_HEADERS);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const rl = await checkRateLimit({
    key: `send-plot-invite:user:${userData.user.id}`,
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

  let body: PlotInviteRequest;
  try {
    body = (await req.json()) as PlotInviteRequest;
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON body' }, 400, CORS_HEADERS);
  }
  if (
    typeof body.plot_id !== 'string' ||
    !UUID_RE.test(body.plot_id) ||
    (body.buyer_name !== undefined && (typeof body.buyer_name !== 'string' || body.buyer_name.length > 120))
  ) {
    return json({ error: 'bad_request' }, 400, CORS_HEADERS);
  }

  const { data: plot, error: plotErr } = await supabase
    .from('plots')
    .select('id, plot_number, reservation_status, reserved_for_email, invite_code, site_id')
    .eq('id', body.plot_id)
    .maybeSingle();
  if (plotErr || !plot) {
    return json({ error: 'not_authorised' }, 403, CORS_HEADERS);
  }

  const { data: site, error: siteErr } = await supabase
    .from('development_sites')
    .select('name, address, organisation_id')
    .eq('id', plot.site_id as string)
    .maybeSingle();
  if (siteErr || !site) {
    return json({ error: 'not_authorised' }, 403, CORS_HEADERS);
  }

  // Authorisation: the caller belongs to the organisation that owns the site.
  const { data: membership, error: membershipErr } = await supabase
    .from('organisation_memberships')
    .select('organisation_id')
    .eq('user_id', userData.user.id)
    .eq('organisation_id', site.organisation_id as string)
    .maybeSingle();
  if (membershipErr || !membership) {
    return json({ error: 'not_authorised' }, 403, CORS_HEADERS);
  }

  // Only a plot held for a named buyer has someone to tell.
  if (plot.reservation_status !== 'pending' || !plot.reserved_for_email || !plot.invite_code) {
    return json({ error: 'not_held' }, 409, CORS_HEADERS);
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', site.organisation_id as string)
    .maybeSingle();

  const developerName = (org?.name as string | undefined)?.trim() || 'Your developer';
  const siteName = (site.name as string | null)?.trim() ?? '';
  const plotLine = siteName ? `${plot.plot_number} at ${siteName}` : (plot.plot_number as string);
  const inviteCode = plot.invite_code as string;
  const buyerEmail = plot.reserved_for_email as string;
  const joinLink = `https://propxchain.com/join/${encodeURIComponent(inviteCode)}`;

  const emailSent = await sendEmail({
    to: buyerEmail,
    subject: `${plotLine} is reserved for you`,
    html: buildInviteHtml({
      buyerName: (body.buyer_name ?? '').trim(),
      developerName,
      plotLine,
      siteAddress: (site.address as string | null)?.trim() ?? '',
      buyerEmail,
      inviteCode,
      joinLink,
    }),
  });

  await supabase.from('plots').update({ email_failed: !emailSent }).eq('id', plot.id as string);

  if (!emailSent) {
    return json({ error: 'email_failed' }, 502, CORS_HEADERS);
  }
  return json({ ok: true }, 200, CORS_HEADERS);
});
