// deno test --allow-env supabase/functions/_shared/chain-invite.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { type InviteReader, readChainInvite } from './chain-invite.ts';

const reader = (answer: () => Promise<[] | [{ inviteCode: string; propertyAddress: string }]>) =>
  () => Promise.resolve({ getInviteForPlatform: () => answer() } as InviteReader);

Deno.test('readChainInvite should return the deal\'s own code and address', async () => {
  const r = await readChainInvite('tx_1', reader(() => Promise.resolve([{ inviteCode: 'TX-ABCD-EFGH', propertyAddress: '1 High St' }])));
  assertEquals(r, { ok: true, invite: { inviteCode: 'TX-ABCD-EFGH', propertyAddress: '1 High St' } });
});

Deno.test('readChainInvite should treat a null answer as not found', async () => {
  assertEquals(await readChainInvite('tx_1', reader(() => Promise.resolve([]))), {
    ok: false, status: 404, error: 'transaction_not_found',
  });
});

Deno.test('readChainInvite should fail with 502, not a guess, when the canister call throws', async () => {
  assertEquals(await readChainInvite('tx_1', reader(() => Promise.reject(new Error('boom')))), {
    ok: false, status: 502, error: 'chain_read_failed',
  });
});

Deno.test('readChainInvite should answer 503 when the platform identity is not configured', async () => {
  const broken = () => Promise.reject(new Error('CONVEYANCER_JOIN_SEED_B64 not configured'));
  assertEquals(await readChainInvite('tx_1', broken), { ok: false, status: 503, error: 'not_configured' });
});
