// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Waitlist capture via the PropXchain Cloudflare Worker
 * (Worker → Supabase row + Resend confirmation email). No SDK dependency —
 * a single POST keeps this usable from any marketing surface.
 */

const WAITLIST_API = 'https://propxchain-waitlist.hatton-marc.workers.dev';

/** Mirrors the Worker's ALLOWED_ROLES — keep in sync with waitlist-worker/index.js. */
export type WaitlistRole = 'buyer' | 'seller' | 'investor' | 'developer' | 'conveyancer' | 'agent' | 'other';

/** Mirrors the Worker's ALLOWED_TIMELINES. */
export type WaitlistTimeline = 'now' | '1_3_months' | '3_6_months' | 'researching';

/** Mirrors the Worker's ALLOWED_SOURCES. */
export type WaitlistSource = 'landing_page' | 'home_mover_report' | 'sellers_page';

export interface WaitlistPayload {
  name: string | null;
  email: string;
  role: WaitlistRole | null;
  postcode?: string | null;
  houseNumber?: string | null;
  timeline?: WaitlistTimeline | null;
  source?: WaitlistSource | null;
}

export interface WaitlistResult {
  ok: boolean;
  duplicate: boolean;
  error?: string;
}

/** Basic shape check — the Worker is the source of truth for validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function addToWaitlist(payload: WaitlistPayload): Promise<WaitlistResult> {
  try {
    const res = await fetch(WAITLIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true, duplicate: !!data.duplicate };
    return { ok: false, duplicate: false, error: data.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, duplicate: false, error: String(e) };
  }
}
