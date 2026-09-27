// supabase/functions/enquiry/index.ts
//
// The public partner, sales and support forms. Each enquiry is emailed to the
// PropXchain inbox with Reply-To set to the sender. Nothing is stored.
//
// These forms used to write the sender's name and email into a canister,
// which put personal data somewhere it can never be erased. Email keeps it
// off-chain.
//
// The caller is an anonymous visitor, so there is no user id to rate-limit on
// and Supabase hides the true client IP. Abuse is contained instead by: a
// honeypot field, a global hourly cap per form, a fixed field list per form,
// and mail only ever going to our own inbox — this endpoint cannot be used to
// email a third party.
//
// Deploy with --no-verify-jwt (anonymous caller).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ENQUIRY_TO = Deno.env.get('ENQUIRY_TO') || 'marc@propxchain.com';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 20;
const MAX_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Kind = 'partner' | 'sales' | 'support';

interface FormSpec {
  title: string;
  /** Extra fields accepted beyond name and email, in email display order. */
  fields: Record<string, { label: string; required: boolean }>;
}

const FORMS: Record<Kind, FormSpec> = {
  partner: {
    title: 'Partner enquiry',
    fields: {
      company: { label: 'Company', required: true },
      website: { label: 'Website', required: false },
      partnerType: { label: 'Partnership type', required: true },
      message: { label: 'Message', required: false },
    },
  },
  sales: {
    title: 'Sales enquiry',
    fields: {
      company: { label: 'Company', required: false },
      phone: { label: 'Phone', required: false },
      userType: { label: 'Role', required: true },
      volume: { label: 'Monthly volume', required: false },
      message: { label: 'Message', required: false },
    },
  },
  support: {
    title: 'Support request',
    fields: {
      subject: { label: 'Topic', required: true },
      message: { label: 'Message', required: true },
    },
  },
};

interface Enquiry {
  kind: Kind;
  name: string;
  email: string;
  fields: Record<string, string>;
  /** Honeypot — hidden from people, filled in by bots. */
  fax: string;
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

function isKind(v: unknown): v is Kind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(FORMS, v);
}

function readString(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > max) return null;
  return v.trim();
}

/** Returns the cleaned enquiry, or null if anything is missing or malformed. */
function parseEnquiry(raw: unknown): Enquiry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isKind(r.kind)) return null;

  const name = readString(r.name, MAX_FIELD_LENGTH);
  const email = readString(r.email, MAX_FIELD_LENGTH);
  if (!name || !email || !EMAIL_PATTERN.test(email)) return null;

  const rawFields = (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [key, spec] of Object.entries(FORMS[r.kind].fields)) {
    const value = readString(rawFields[key], key === 'message' ? MAX_MESSAGE_LENGTH : MAX_FIELD_LENGTH);
    if (value === null || (spec.required && !value)) return null;
    fields[key] = value;
  }

  return { kind: r.kind, name, email, fields, fax: typeof r.fax === 'string' ? r.fax : '' };
}

function buildHtml(e: Enquiry): string {
  const spec = FORMS[e.kind];
  const row = (k: string, v: string): string =>
    `<tr><td style="padding:6px 12px;color:#6b7280;vertical-align:top;">${k}</td>` +
    `<td style="padding:6px 12px;white-space:pre-wrap;">${escapeHtml(v)}</td></tr>`;
  const rows = [row('Name', e.name), row('Email', e.email)];
  for (const [key, { label }] of Object.entries(spec.fields)) {
    if (e.fields[key]) rows.push(row(label, e.fields[key]));
  }
  return `<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;font-size:14px;">
<p>New ${spec.title.toLowerCase()} from propxchain.com.</p>
<table cellpadding="0" cellspacing="0">${rows.join('')}</table>
<p style="color:#6b7280;font-size:12px;">Reply to this email to reach them directly.</p>
</body></html>`;
}

async function sendEmail(e: Enquiry): Promise<boolean> {
  const who = e.fields.company || e.name;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PropXchain <noreply@propxchain.com>',
        to: [ENQUIRY_TO],
        reply_to: e.email,
        subject: `${FORMS[e.kind].title}: ${who}`,
        html: buildHtml(e),
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
  const enquiry = parseEnquiry(raw);
  if (!enquiry) return json({ error: 'invalid_fields' }, 400, CORS_HEADERS);

  // A bot that filled the honeypot gets the same success reply a person
  // does, so it learns nothing about what tripped it.
  if (enquiry.fax) return json({ success: true }, 200, CORS_HEADERS);

  const rl = await checkRateLimit({
    key: `enquiry:${enquiry.kind}:global`,
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

  const sent = await sendEmail(enquiry);
  return json({ success: sent }, sent ? 200 : 502, CORS_HEADERS);
});
