// supabase/functions/_shared/bearer-secret.ts
//
// `Authorization: Bearer <shared secret>` for cron-triggered functions.
// A plain `!==` exits at the first differing byte, so response timing leaks
// how much of a guess was right (security scan L6). Hash both sides and
// compare the digests in constant time; the digests are equal length
// whatever was sent.

import { timingSafeEqual } from 'https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts';

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** False when no secret is configured, so a missing env var never opens the door. */
export async function bearerMatches(req: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const presented = req.headers.get('authorization') ?? '';
  return timingSafeEqual(await digest(presented), await digest(`Bearer ${secret}`));
}
