// deno test supabase/functions/_shared/bearer-secret.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { bearerMatches } from './bearer-secret.ts';

const req = (auth?: string): Request =>
  new Request('https://x.test/', { headers: auth === undefined ? {} : { authorization: auth } });

Deno.test('bearerMatches should accept the exact bearer secret', async () => {
  assertEquals(await bearerMatches(req('Bearer s3cret'), 's3cret'), true);
});

Deno.test('bearerMatches should reject a wrong, partial or missing token', async () => {
  assertEquals(await bearerMatches(req('Bearer s3cre'), 's3cret'), false);
  assertEquals(await bearerMatches(req('s3cret'), 's3cret'), false);
  assertEquals(await bearerMatches(req(), 's3cret'), false);
});

Deno.test('bearerMatches should fail closed when no secret is configured', async () => {
  assertEquals(await bearerMatches(req('Bearer '), undefined), false);
  assertEquals(await bearerMatches(req('Bearer '), ''), false);
});
