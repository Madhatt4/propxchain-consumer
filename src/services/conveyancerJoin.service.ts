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

function stashPendingJoinCode(code: string): void {
  localStorage.setItem(PENDING_JOIN_CODE_KEY, code);
}

function readPendingJoinCode(): string | null {
  return localStorage.getItem(PENDING_JOIN_CODE_KEY);
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
