/**
 * Delivery channels for the Move Narrator's drafted messages.
 *
 * Design: each send reads its provider credentials from Supabase function
 * secrets. If the credentials are absent the channel is a safe no-op (status
 * 'skipped') — so the whole pipeline works today and each channel "turns on"
 * the moment you add its key. Nothing here fabricates a recipient or message.
 *
 *   SMS  → Twilio.  Set: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   Email→ Resend.  Set: RESEND_API_KEY, RESEND_FROM   (swap provider if you prefer)
 *   In-app→ returned to the client to render in the existing notifications feed.
 *
 * SECURITY (audit 2026-07-25, finding #2): the `recipient` passed in here is
 * derived from the authenticated session in index.ts. It must never again be
 * sourced from the request body — that made this an open relay on PropXchain's
 * own verified sending domain and Twilio number.
 */

import type { ChannelResult, NarrationOutputs, Recipient } from './types.ts';

/**
 * Build the delivery recipient from a Supabase auth user record only.
 *
 * Never accepts an address from a request body. E.164 is required for SMS;
 * anything else is dropped rather than handed to Twilio. Shared by the
 * user-JWT path (index.ts, the authenticated caller's own session) and the
 * Bearer-secret `monitor_fire` path (monitor.ts, a party fetched server-side
 * via `auth.admin.getUserById` — see monitor.ts's module header for why there
 * is no end-user session there).
 */
export function recipientFromUser(user: {
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Recipient {
  const out: Recipient = {};
  if (typeof user.email === 'string' && user.email.trim()) {
    out.email = user.email.trim();
  }
  const meta = user.user_metadata ?? {};
  const rawPhone =
    (typeof user.phone === 'string' && user.phone) ||
    (typeof meta.phone === 'string' && meta.phone) ||
    (typeof meta.mobile === 'string' && meta.mobile) ||
    '';
  const phone = rawPhone.trim();
  if (/^\+[1-9]\d{7,14}$/.test(phone)) {
    out.mobile = phone;
  }
  return out;
}

/** Send the drafted SMS via Twilio. No-op (skipped) until TWILIO_* secrets are set. */
export async function sendSms(to: string, body: string): Promise<ChannelResult> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) {
    return { channel: 'sms', status: 'skipped', detail: 'Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable' };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!res.ok) return { channel: 'sms', status: 'error', detail: `Twilio ${res.status}: ${await res.text()}` };
  return { channel: 'sms', status: 'sent' };
}

/** Parse the agent's email.md (YAML front-matter `subject:` + Markdown body). */
export function parseEmail(markdown: string): { subject: string; body: string } {
  const m = markdown.match(/^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*[\r\n]([\s\S]*)$/);
  if (!m) return { subject: 'An update on your move', body: markdown.trim() };
  const subjectLine = m[1].split(/[\r\n]+/).find((l) => l.trim().toLowerCase().startsWith('subject:'));
  const subject = subjectLine ? subjectLine.replace(/^[^:]*:\s*/, '').replace(/^["']|["']$/g, '').trim() : 'An update on your move';
  return { subject, body: m[2].trim() };
}

/** Send the drafted email via Resend. No-op (skipped) until RESEND_API_KEY is set. */
export async function sendEmail(to: string, subject: string, body: string): Promise<ChannelResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  if (!key || !from) {
    return { channel: 'email', status: 'skipped', detail: 'Email sender not configured — set RESEND_API_KEY and RESEND_FROM to enable' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: body }),
  });
  if (!res.ok) return { channel: 'email', status: 'error', detail: `Resend ${res.status}: ${await res.text()}` };
  return { channel: 'email', status: 'sent' };
}

/**
 * Deliver the narration across all channels. In-app is returned to the caller
 * (the frontend renders it in the existing notifications feed); email + SMS are
 * sent here if the authenticated user has those contact details on file and the
 * provider keys are present.
 */
export async function deliverNarration(outputs: NarrationOutputs, recipient: Recipient): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [
    { channel: 'in_app', status: outputs.notification ? 'returned_to_client' : 'skipped', detail: outputs.notification ? undefined : 'no notification.json produced' },
  ];

  if (outputs.emailMarkdown && recipient.email) {
    const { subject, body } = parseEmail(outputs.emailMarkdown);
    results.push(await sendEmail(recipient.email, subject, body));
  } else {
    results.push({ channel: 'email', status: 'skipped', detail: 'no email body or no recipient.email' });
  }

  if (outputs.sms && recipient.mobile) {
    results.push(await sendSms(recipient.mobile, outputs.sms));
  } else {
    results.push({ channel: 'sms', status: 'skipped', detail: 'no sms text or no recipient.mobile' });
  }
  return results;
}
