// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Conveyancer Brief — client wrapper for the `conveyancer-brief` Supabase edge
 * function. The edge function is the only place `ANTHROPIC_API_KEY` and
 * `RESEND_API_KEY` live, so the client never composes the email text and
 * never sees those secrets. This module is a thin, typed wrapper over the
 * three actions:
 *
 *   compose → LLM-render a "work arising" draft from the transaction's
 *             completed scans, for the accepted conveyancer. NEVER sends.
 *   get     → reload the current draft (or null when there is none).
 *   send    → dispatch the draft to the instructed conveyancer's inbox.
 *
 * Draft-then-send is enforced server-side, not just here: `compose` can only
 * ever return a draft or `{ briefId: null, reason: 'no_work_arising' }`, and
 * only an explicit `send` call reaches a real solicitor's inbox.
 *
 * Shape mirrors moveNarrator.service.ts (one `invokeAction` wrapper behind
 * plain exported functions, throwing rather than swallowing errors). Error
 * extraction instead follows partyInvite.service.ts's technique, because —
 * unlike move-narrator, which always returns 200 with an `{error}` body —
 * this function returns every failure as a real non-2xx status
 * (403/404/409/429/502/503), and the UI must branch on that status. See
 * `supabase/functions/conveyancer-brief/index.ts` (monorepo) for the
 * authoritative contract.
 */
import { supabase } from '../lib/supabase';

const FUNCTION_NAME = 'conveyancer-brief';

export type ConveyancerBriefStatus = 'draft' | 'sending' | 'sent';

export interface ConveyancerBriefDraft {
  briefId: string;
  subject: string;
  bodyMd: string;
  itemCount: number;
  /** Evidence gaps, e.g. "Title scan not yet available" — why the brief may be thin. */
  notAvailable: string[];
  /** 'sending' means a send is in flight for this draft — the UI must disable send. */
  status: ConveyancerBriefStatus;
}

/** `compose` returns this instead of a draft when the scans produced no work items. */
export interface ConveyancerBriefNoWorkArising {
  briefId: null;
  reason: 'no_work_arising';
}

export type ComposeConveyancerBriefResult = ConveyancerBriefDraft | ConveyancerBriefNoWorkArising;

export interface SendConveyancerBriefResult {
  sent: true;
  conveyancerId: string;
}

export function isNoWorkArising(
  result: ComposeConveyancerBriefResult,
): result is ConveyancerBriefNoWorkArising {
  return result.briefId === null;
}

/**
 * Thrown for every non-2xx response. `status` is the HTTP status the edge
 * function returned; `code` is the `error` field from its JSON body (falling
 * back to the transport message when the body can't be read at all, e.g. a
 * pure network failure with no response). The UI branches on `status` first
 * — see the contract's distinct codes: 403 `forbidden` (no accepted
 * conveyancer quote — feature unavailable), 404 `not_found` (unknown brief),
 * 409 `already_sent` / `already_sending` / `conflict` (can't send right now
 * — treat together), 502 `send_failed` / `conveyancer_email_unavailable` /
 * `compose_failed` (draft is untouched, retry is safe), 429 `rate_limited`
 * (`resetIn` seconds, when present).
 */
export class ConveyancerBriefError extends Error {
  readonly status: number;
  readonly code: string;
  readonly resetIn?: number;

  constructor(status: number, code: string, resetIn?: number) {
    super(code);
    this.name = 'ConveyancerBriefError';
    this.status = status;
    this.code = code;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: {
    status?: number;
    json?: () => Promise<Record<string, unknown>>;
  };
}

/**
 * `conveyancer-brief` returns every failure (400/401/403/404/409/429/502/503)
 * as a non-2xx response, so supabase-js throws a FunctionsHttpError whose
 * `.context` is the raw Response — `.status` is the HTTP code and `.json()`
 * is the `{ error, resetIn? }` body the edge function wrote. Falls back to a
 * 0 status / the transport message when there is no context at all (a pure
 * network failure) or the body can't be parsed as JSON. Same technique as
 * partyInvite.service.ts's `extractInvokeErrorMessage`, extended to keep the
 * status code this contract's UI needs to branch on.
 */
async function toBriefError(error: FunctionsInvokeError): Promise<ConveyancerBriefError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; resetIn?: number } | undefined;
    const code = typeof body?.error === 'string' ? body.error : error.message;
    return new ConveyancerBriefError(status, code, body?.resetIn);
  } catch {
    return new ConveyancerBriefError(status, error.message);
  }
}

async function invokeAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FUNCTION_NAME, { body });
  if (error) throw await toBriefError(error as FunctionsInvokeError);
  return data as T;
}

/**
 * Compose (or replace) the draft for this transaction's side. Never sends —
 * the mover must read the draft and call `sendConveyancerBrief` explicitly.
 * Throws `ConveyancerBriefError` with status 403 when there is no accepted
 * conveyancer quote for the caller on this transaction.
 */
export async function composeConveyancerBrief(transactionId: string): Promise<ComposeConveyancerBriefResult> {
  return invokeAction<ComposeConveyancerBriefResult>({ action: 'compose', transactionId });
}

/** The current draft for this transaction's side, or null when there is none. */
export async function getConveyancerBriefDraft(transactionId: string): Promise<ConveyancerBriefDraft | null> {
  return invokeAction<ConveyancerBriefDraft | null>({ action: 'get', transactionId });
}

/** Dispatch the draft to the instructed conveyancer. Requires explicit user confirmation upstream. */
export async function sendConveyancerBrief(briefId: string): Promise<SendConveyancerBriefResult> {
  return invokeAction<SendConveyancerBriefResult>({ action: 'send', briefId });
}
