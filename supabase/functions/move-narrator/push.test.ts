// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Unit tests for the push channel's pure logic (no network / no Deno.env).
 * Run: deno test supabase/functions/move-narrator/push.test.ts
 */

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PUSH_BODY, PUSH_TITLE, buildFcmMessage, isDeadToken, parseServiceAccount } from './push.ts';
import { recipientFromUser } from './delivery.ts';

Deno.test('push text is generic: no address, name or money', () => {
  const text = `${PUSH_TITLE} ${PUSH_BODY}`;
  assert(!/\d/.test(text), 'no digits (no prices, house numbers or postcodes)');
  assert(!/£/.test(text));
});

Deno.test('buildFcmMessage sends only the generic text and the transaction id', () => {
  const m = buildFcmMessage('tok-1', 'tx-abc') as { message: Record<string, unknown> };
  assertEquals(m.message.token, 'tok-1');
  assertEquals(m.message.notification, { title: PUSH_TITLE, body: PUSH_BODY });
  assertEquals(m.message.data, { txId: 'tx-abc' });
});

Deno.test('buildFcmMessage omits data when there is no transaction id', () => {
  const m = buildFcmMessage('tok-1') as { message: Record<string, unknown> };
  assertEquals(m.message.data, {});
});

Deno.test('isDeadToken recognises removed apps and leaves other errors alone', () => {
  assertEquals(isDeadToken(404, ''), true);
  assertEquals(isDeadToken(400, '{"error":{"status":"UNREGISTERED"}}'), true);
  assertEquals(isDeadToken(500, 'internal'), false);
  assertEquals(isDeadToken(401, 'bad credentials'), false);
});

Deno.test('parseServiceAccount needs project, email and key', () => {
  assertEquals(parseServiceAccount(undefined), null);
  assertEquals(parseServiceAccount('not json'), null);
  assertEquals(parseServiceAccount('{"project_id":"p"}'), null);
  const ok = parseServiceAccount('{"project_id":"p","client_email":"e@x","private_key":"k"}');
  assertEquals(ok?.project_id, 'p');
});

Deno.test('recipientFromUser carries the user id for push lookup, never from a body', () => {
  const r = recipientFromUser({ id: 'user-1', email: 'a@b.co' });
  assertEquals(r.userId, 'user-1');
  assertEquals(recipientFromUser({ email: 'a@b.co' }).userId, undefined);
});
