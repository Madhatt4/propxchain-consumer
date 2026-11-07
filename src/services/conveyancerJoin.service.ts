/**
 * Conveyancer join-code redemption — the winner side of the accept flow.
 *
 * When a party accepts a quote, the accept-conveyancer-quote edge function
 * emails the winning firm a one-time code. This service previews that
 * invitation (public — the 256-bit code is the bearer) and redeems it once
 * the conveyancer is signed in, which assigns their principal to the
 * transaction on-chain via the redeem-conveyancer-join edge function.
 *
 * The pending-code stash mirrors the developer-invite pattern: redemption
 * needs the caller's ICP principal, which only exists after first sign-in,
 * so a code arriving before signup waits in localStorage until the
 * conveyancer dashboard consumes it.
 */
import { supabase } from '../lib/supabase';
import { buildPrincipalProof } from './principalProof';
import type { PrincipalProof } from './principalProof';
import { logger } from '@/utils/logger';

export const PENDING_JOIN_CODE_KEY = 'propxchain_pending_conveyancer_join_code';

export interface JoinPreview {
  firmName: string | null;
  firmCity: string | null;
  firmPostcode: string | null;
  clcId: string;
  propertyAddress: string | null;
  transactionType: string | null;
  expiresAt: string;
}

/** The question PendingJoinBanners asks before redeeming a saved code: "Join Acme Law on 1 High Street?" */
export function joinOfferText(preview: Pick<JoinPreview, 'firmName' | 'propertyAddress'>): string {
  const firm = preview.firmName ?? 'your firm';
  const property = preview.propertyAddress ?? 'this property';
  return `Join ${firm} on ${property}?`;
}

export type JoinPreviewError = 'invalid_code' | 'already_redeemed' | 'expired' | 'network';

export interface RedeemResult {
  success: boolean;
  transactionId?: string;
  firmName?: string;
  clcId?: string;
  error?: string;
  detail?: string;
}

function functionsBase(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
}

async function previewJoinCode(code: string): Promise<{ preview?: JoinPreview; error?: JoinPreviewError }> {
  try {
    const res = await fetch(`${functionsBase()}/redeem-conveyancer-join?code=${encodeURIComponent(code)}`);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = (body as { error?: string } | null)?.error;
      if (err === 'already_redeemed' || err === 'expired') return { error: err };
      return { error: 'invalid_code' };
    }
    return { preview: body as JoinPreview };
  } catch (err) {
    logger.error('[conveyancerJoin] preview failed', { err: String(err) });
    return { error: 'network' };
  }
}

export type JoinProof = PrincipalProof;

/**
 * Prove control of the ICP principal being bound to the transaction (#130).
 * Signing `{code}:{userId}` is what makes a captured proof worthless to anyone
 * redeeming under a different account. The signing itself is shared with the
 * other #130 consumers — see principalProof.ts.
 */
export async function buildJoinProof(code: string, userId: string): Promise<JoinProof> {
  return buildPrincipalProof(`${code}:${userId}`);
}

async function redeemJoinCode(code: string): Promise<RedeemResult> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return { success: false, error: 'unauthorized' };
  }

  let proof: JoinProof;
  try {
    proof = await buildJoinProof(code, userData.user.id);
  } catch (err) {
    logger.error('[conveyancerJoin] proof failed', { err: String(err) });
    return { success: false, error: 'no_principal' };
  }

  const { data, error } = await supabase.functions.invoke('redeem-conveyancer-join', {
    body: { code, ...proof },
  });
  if (error) {
    // supabase-js wraps non-2xx responses; the response body carries the
    // machine-readable error the edge function returned.
    let errCode = error.message;
    let detail: string | undefined;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      if (body) {
        errCode = body.error ?? errCode;
        detail = body.message ?? body.detail;
      }
    }
    logger.error('[conveyancerJoin] redeem failed', { error: errCode, detail });
    return { success: false, error: errCode, detail };
  }
  return { success: true, ...(data as Omit<RedeemResult, 'success'>) };
}

/**
 * A saved code lives a day (card 5de4b8d4): long enough to verify an email
 * and sign in, short enough that a code left on a shared machine does not
 * wait for the next person to sign in. It is never redeemed without a click
 * (PendingJoinBanners asks first).
 */
export const PENDING_JOIN_CODE_TTL_MS = 24 * 60 * 60 * 1000;

interface StashedCode {
  code: string;
  savedAt: number;
}

function stashPendingJoinCode(code: string, now: number = Date.now()): void {
  const value: StashedCode = { code, savedAt: now };
  localStorage.setItem(PENDING_JOIN_CODE_KEY, JSON.stringify(value));
}

function parseStash(raw: string): StashedCode | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const { code, savedAt } = value as Partial<StashedCode>;
    return typeof code === 'string' && typeof savedAt === 'number' ? { code, savedAt } : null;
  } catch {
    return null;
  }
}

/** The saved code, or null. An expired or unreadable entry (including the old plain-string form) is removed. */
function readPendingJoinCode(now: number = Date.now()): string | null {
  const raw = localStorage.getItem(PENDING_JOIN_CODE_KEY);
  if (raw === null) return null;
  const stash = parseStash(raw);
  if (!stash || now - stash.savedAt > PENDING_JOIN_CODE_TTL_MS || stash.savedAt > now) {
    localStorage.removeItem(PENDING_JOIN_CODE_KEY);
    return null;
  }
  return stash.code;
}

function clearPendingJoinCode(): void {
  localStorage.removeItem(PENDING_JOIN_CODE_KEY);
}

export const conveyancerJoinService = {
  previewJoinCode,
  redeemJoinCode,
  stashPendingJoinCode,
  readPendingJoinCode,
  clearPendingJoinCode,
};
