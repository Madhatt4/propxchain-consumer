// supabase/functions/demo-request/index.ts
//
// "Book a 20-min demo" from the landing page. Emails the request to the
// PropXchain inbox with Reply-To set to the requester, so booking the call is
// one reply. Nothing is stored: the email is the record.
//
// The caller is an anonymous visitor, so there is no user id to rate-limit on
// and Supabase hides the true client IP. Abuse is contained instead by: a
// honeypot field, a global hourly cap, and the fact that mail only ever goes
// to our own inbox — this endpoint cannot be used to email a third party.
//
// Deploy with --no-verify-jwt (anonymous caller).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DEMO_REQUEST_TO = Deno.env.get('DEMO_REQUEST_TO') || 'marc@propxchain.com';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 20;
const MAX_FIELD_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface DemoRequest {
  company: string;
  name: string;
  email: string;
  /** Honeypot — hidden from people, filled in by bots. */
  website?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function parseRequest(raw: unknown): DemoRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const fields = ['company', 'name', 'email'] as const;
  for (const f of fields) {
    const v = r[f];
    if (typeof v !== 'string' || !v.trim() || v.length > MAX_FIELD_LENGTH) return null;
  }
  const email = (r.email as string).trim();
  if (!EMAIL_PATTERN.test(email)) return null;
  return {
    company: (r.company as string).trim(),
    name: (r.name as string).trim(),
    email,
    website: typeof r.website === 'string' ? r.website : undefined,
  };
}

function buildHtml(d: DemoRequest): string {
  const row = (k: string, v: string): string =>
    `<tr><td style="padding:6px 12px;color:#6b7280;">${k}</td><td style="padding:6px 12px;">${escapeHtml(v)}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;font-size:14px;">
<p>New demo request from the PropXchain landing page (developers section).</p>
<table cellpadding="0" cellspacing="0">${row('Company', d.company)}${row('Name', d.name)}${row('Email', d.email)}</table>
<p style="color:#6b7280;font-size:12px;">Reply to this email to reach them directly.</p>
</body></html>`;
}

async function sendEmail(d: DemoRequest): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PropXchain <noreply@propxchain.com>',
        to: [DEMO_REQUEST_TO],
        reply_to: d.email,
        subject: `Demo request: ${d.company}`,
        html: buildHtml(d),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, CORS_HEADERS);
  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfiguration: missing env vars' }, 500, CORS_HEADERS);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, CORS_HEADERS);
  }
  const body = parseRequest(raw);
  if (!body) return json({ error: 'invalid_fields' }, 400, CORS_HEADERS);

  // A bot that filled the honeypot gets the same success reply a person
  // does, so it learns nothing about what tripped it.
  if (body.website) return json({ success: true }, 200, CORS_HEADERS);

  const rl = await checkRateLimit({
    key: 'demo-request:global',
    limit: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    supabaseAdmin: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) },
    });
  }

  const sent = await sendEmail(body);
  return json({ success: sent }, sent ? 200 : 502, CORS_HEADERS);
});
