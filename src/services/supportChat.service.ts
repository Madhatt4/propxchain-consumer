// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Support chat: the typed client for the monorepo-owned `support-chat` edge
 * function (not one of this repo's own `supabase/functions/`). One call — send
 * the conversation so far, get the next reply.
 *
 * The function stores nothing. A conversation lives in the open panel and
 * nowhere else, which is why there is no history to fetch here; the only path
 * that ever persists one is the user asking for a ticket, through
 * `supportTicket.service`. The caller never states who it is either — the
 * function reads the session off the JWT.
 *
 * Every cap below mirrors `supabase/functions/support-chat/request.ts`. They
 * are duplicated rather than imported because the function is Deno in another
 * repo; the tests pin them so a drift shows up here as a failure rather than
 * as a 400 in front of a customer.
 */
import { supabase } from '../lib/supabase';
import type { TransactionStatus } from '../types/transactionStatus';

/** The function keeps only the most recent turns; sending more is wasted bytes. */
export const MAX_MESSAGES = 10;
/** Per message. The function REJECTS a longer one rather than trimming it. */
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_PAGE_PATH_CHARS = 200;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/**
 * The function's `stage` is the on-chain `TransactionStatus` variant list, and
 * this repo's own union is that same list, so a status goes over the wire
 * as-is. An unknown value is dropped server-side, not rejected.
 */
export type ChatStage = TransactionStatus;

export interface ChatContext {
  pagePath: string;
  transactionId?: string;
  stage?: ChatStage;
}

/**
 * `confidence` is Jev's read on whether the reply actually answered, and
 * `suggestTicket` is its verdict on whether to offer a person. Neither is a
 * score to show the user: they decide what the widget offers, not what it says.
 */
export interface ChatReply {
  reply: string;
  intent: string;
  confidence: number;
  suggestTicket: boolean;
  sources: string[];
  model: string;
}

/**
 * A non-2xx from the function. `code` is the function's own `error` field
 * (`invalid_request`, `rate_limited`, `forbidden`, `chat_failed`, …), not a
 * prose message, so the UI branches on it rather than matching strings.
 */
export class SupportChatError extends Error {
  readonly status: number;
  readonly code: string;
  readonly resetIn?: number;
  constructor(status: number, code: string, resetIn?: number) {
    super(code);
    this.name = 'SupportChatError';
    this.status = status;
    this.code = code;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}

async function toSupportChatError(error: FunctionsInvokeError): Promise<SupportChatError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; resetIn?: number } | undefined;
    return new SupportChatError(status, typeof body?.error === 'string' ? body.error : error.message, body?.resetIn);
  } catch {
    return new SupportChatError(status, error.message);
  }
}

/**
 * The turns as the function will accept them: the most recent window, empties
 * dropped, each one inside the per-message cap.
 *
 * An assistant reply is trimmed rather than dropped. The prose model is not
 * bounded to 2000 characters at source, and the function rejects the whole
 * request over one oversized turn — so an unusually long answer would poison
 * every later message in the conversation instead of just being verbose.
 */
export function toWireMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.trim() }))
    .filter((m) => m.text.length > 0)
    .map((m) => (m.text.length > MAX_MESSAGE_CHARS ? { role: m.role, text: `${m.text.slice(0, MAX_MESSAGE_CHARS - 1)}…` } : m));
}

/** Only the fields that are set — the function validates a present-but-empty one. */
function toWireContext(context: ChatContext): Record<string, unknown> {
  const wire: Record<string, unknown> = { pagePath: context.pagePath.slice(0, MAX_PAGE_PATH_CHARS) };
  if (context.transactionId) wire.transactionId = context.transactionId;
  if (context.stage) wire.stage = context.stage;
  return wire;
}

/**
 * Ask for the next reply. `messages` is the whole conversation including the
 * turn the user has just typed, which must be the last one.
 */
export async function sendChatMessage(messages: ChatMessage[], context: ChatContext): Promise<ChatReply> {
  const { data, error } = await supabase.functions.invoke<ChatReply>('support-chat', {
    body: { messages: toWireMessages(messages), context: toWireContext(context) },
  });
  if (error) throw await toSupportChatError(error as FunctionsInvokeError);
  if (!data) throw new SupportChatError(0, 'empty_response');
  return data;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Your session has expired. Sign in again and the chat will come back.',
  forbidden: 'I cannot read that transaction for you. Open a ticket and a person will pick it up.',
  invalid_request: 'I could not read that message. Try rephrasing it a little shorter.',
  rate_limited: 'That is a lot of questions at once. Give it a moment and try again.',
  chat_failed: 'Something went wrong at our end. Try again, or open a ticket and a person will pick it up.',
  empty_response: 'Something went wrong at our end. Try again, or open a ticket and a person will pick it up.',
};

/**
 * What to put in front of the user. Anything unrecognised reads as a fault at
 * our end rather than as something they did wrong, because it is.
 */
export function chatErrorMessage(error: unknown): string {
  const code = error instanceof SupportChatError ? error.code : '';
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.chat_failed;
}
