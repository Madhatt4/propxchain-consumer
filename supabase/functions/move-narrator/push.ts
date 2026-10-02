// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Push channel for the Move Narrator: a phone notification through Firebase
 * Cloud Messaging (which reaches iPhones through Apple's service and Android
 * phones directly).
 *
 * Same design as the other channels in delivery.ts: credentials come from
 * Supabase function secrets and, if they are absent, the channel is a safe
 * no-op ('skipped'). Set FCM_SERVICE_ACCOUNT_JSON to the Firebase service
 * account key (the whole JSON) to turn it on.
 *
 * PRIVACY: the text is deliberately generic. It carries no address, name or
 * transaction detail, because push text passes through Apple and Google. The
 * only data field is the transaction id, which the app uses to open the right
 * screen. The recipient is the authenticated user's own devices, looked up by
 * user id on the server, never taken from a request body.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { ChannelResult } from './types.ts';

export const PUSH_TITLE = 'PropXchain';
export const PUSH_BODY = 'There is an update on your move. Open the app to see what happens next.';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return parsed as ServiceAccount;
    }
  } catch {
    // fall through
  }
  return null;
}

export function buildFcmMessage(token: string, txId?: string): Record<string, unknown> {
  return {
    message: {
      token,
      notification: { title: PUSH_TITLE, body: PUSH_BODY },
      data: txId ? { txId } : {},
      android: { priority: 'HIGH' },
      apns: { payload: { aps: { sound: 'default' } } },
    },
  };
}

/** FCM answers 404 / UNREGISTERED when the app has been removed from the phone. */
export function isDeadToken(status: number, bodyText: string): boolean {
  return status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*token/i.test(bodyText);
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Google token response had no access_token');
  return json.access_token;
}

/** Send the push to every phone registered to this user. */
export async function sendPush(
  admin: SupabaseClient,
  userId: string,
  txId?: string,
): Promise<ChannelResult> {
  const sa = parseServiceAccount(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON'));
  if (!sa) {
    return { channel: 'push', status: 'skipped', detail: 'Firebase not configured - set FCM_SERVICE_ACCOUNT_JSON to enable' };
  }

  const { data: rows, error } = await admin.from('device_push_tokens').select('token').eq('user_id', userId);
  if (error) return { channel: 'push', status: 'error', detail: `token lookup failed: ${error.message}` };
  const tokens = (rows ?? []).map((r: { token: string }) => r.token);
  if (tokens.length === 0) return { channel: 'push', status: 'skipped', detail: 'no registered phones' };

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    return { channel: 'push', status: 'error', detail: e instanceof Error ? e.message : 'auth failed' };
  }

  let sent = 0;
  const failures: string[] = [];
  for (const token of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFcmMessage(token, txId)),
    });
    if (res.ok) {
      sent += 1;
      continue;
    }
    const text = await res.text();
    if (isDeadToken(res.status, text)) {
      await admin.from('device_push_tokens').delete().eq('token', token);
    } else {
      failures.push(`FCM ${res.status}`);
    }
  }

  if (sent > 0) return { channel: 'push', status: 'sent', detail: `${sent} of ${tokens.length} phones` };
  if (failures.length > 0) return { channel: 'push', status: 'error', detail: failures[0] };
  return { channel: 'push', status: 'skipped', detail: 'registered phones were no longer valid' };
}
