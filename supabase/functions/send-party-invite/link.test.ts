// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
// deno test supabase/functions/send-party-invite/link.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { inviteFootnote, inviteLink } from './link.ts';

const CODE = 'TX-ABCD-EFGH';

Deno.test('inviteLink should send a seller to the accept page with no invite code', () => {
  const link = inviteLink({ role: 'seller', transactionId: 'tx_1794076530509808062', inviteCode: CODE, side: 'seller', invitedByPrincipal: 'aaaaa-aa' });
  assertEquals(link, 'https://propxchain.com/seller-invite/tx_1794076530509808062');
  assert(!link.includes(CODE));
  assert(!link.includes('TX-'));
});

Deno.test('inviteLink should keep the join link for a buyer', () => {
  assertEquals(
    inviteLink({ role: 'buyer', transactionId: 'tx_1', inviteCode: CODE, side: 'buyer', invitedByPrincipal: 'aaaaa-aa' }),
    'https://propxchain.com/join/TX-ABCD-EFGH?role=buyer&side=buyer&by=aaaaa-aa',
  );
});

Deno.test('inviteLink should encode the transaction id in the seller link', () => {
  assertEquals(
    inviteLink({ role: 'seller', transactionId: 'tx/1?x', inviteCode: CODE, invitedByPrincipal: '' }),
    'https://propxchain.com/seller-invite/tx%2F1%3Fx',
  );
});

Deno.test('inviteFootnote should tell the seller to use the invited email', () => {
  assert(inviteFootnote('seller').includes('with this email address'));
  assertEquals(inviteFootnote('buyer'), 'Create your free PropXchain account to open your sale — it takes a minute.');
});
