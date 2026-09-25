// supabase/functions/_shared/rate-limit.ts
//
// Persistent rate limiter for Supabase edge functions, backed by the
// `public.check_rate_limit` Postgres RPC (migration 20260522000002).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CheckRateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  supabaseAdmin: SupabaseClient;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Atomically increments the bucket and returns whether the caller is
 * inside the limit. Fail-open: any RPC error allows the request.
 */
export async function checkRateLimit(
  opts: CheckRateLimitOptions,
): Promise<RateLimitResult> {
  const { key, limit, windowSeconds, supabaseAdmin } = opts;

  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error(
        `[rate-limit] RPC failed for key=${key}; FAILING OPEN. error=`,
        error,
      );
      return { allowed: true, retryAfter: 0 };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      console.error(
        `[rate-limit] unexpected RPC response shape for key=${key}; FAILING OPEN. data=`,
        data,
      );
      return { allowed: true, retryAfter: 0 };
    }

    return {
      allowed: row.allowed === true,
      retryAfter:
        typeof row.retry_after_seconds === 'number' ? row.retry_after_seconds : 0,
    };
  } catch (err) {
    console.error(
      `[rate-limit] threw for key=${key}; FAILING OPEN. err=`,
      err,
    );
    return { allowed: true, retryAfter: 0 };
  }
}

/**
 * Best-available caller identity for keying a rate limiter.
 *
 * IMPORTANT — read before using this for anything per-user.
 *
 * The old implementation keyed on the LEFTMOST X-Forwarded-For entry. XFF is a
 * chain each hop appends to, and its left end is whatever the CALLER sent, so
 * an attacker rotating that header minted a fresh bucket per request and
 * bypassed the limit entirely (audit 2026-07-25, finding #7).
 *
 * Measured behaviour on Supabase edge functions (2026-07-25): the gateway
 * OVERWRITES both `x-real-ip` and `x-forwarded-for` before the function sees
 * them. A request sending `X-Real-IP: 9.9.9.9` and `X-Forwarded-For: 8.8.8.8`
 * arrived with neither value present. That gives us the security property we
 * need — the caller cannot influence the key — but it also means the TRUE
 * client IP is not exposed to edge functions at all. Both headers resolve to
 * Supabase's own edge egress pool (observed: a handful of 3.2.48.0/24
 * addresses shared by all callers).
 *
 * Consequence: this is NOT a per-client identity. It is a small, unforgeable
 * set of shared buckets, so an IP-keyed limit behaves as a coarse GLOBAL cap.
 * Size limits accordingly — protect the upstream quota, do not try to give each
 * visitor a personal allowance. Where a real per-caller limit is needed, key on
 * the authenticated user id instead (see move-narrator and
 * optimus-survey-referral, which use `...:user:${user.id}`).
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return 'unknown';
}
