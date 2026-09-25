// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Support tickets: the typed client for the monorepo-owned `support-ticket`
 * edge function (not one of this repo's own `supabase/functions/`). Five
 * actions — create, list, get, reply, close.
 *
 * A ticket is a person's own words about their own move, so it is personal
 * data and lives in Supabase, never on a canister. The caller never states who
 * it is: the function reads the name and email off the verified session JWT,
 * which is why neither is sent from here.
 *
 * Every write goes through the function. Replying by writing to
 * `support_ticket_messages` directly would skip the ownership check and the
 * reopen-and-bump the function does alongside the insert, so the ticket would
 * silently stay parked in whatever state it was in.
 */
import { supabase } from '../lib/supabase';

/** Column check constraints, mirrored so the form can stop a doomed request. */
export const MAX_SUBJECT = 200;
export const MAX_BODY = 5000;

export const TICKET_STATUSES = ['open', 'awaiting_user', 'answered', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = [
  'account',
  'id_aml',
  'forms',
  'searches',
  'payments',
  'conveyancer',
  'transaction',
  'bug',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type MessageAuthor = 'user' | 'admin' | 'bot';

/** Where the ticket came from: the support form, or the chat widget. */
export type TicketSource = 'form' | 'chat';

/**
 * One ticket. `status` and `category` are Postgres enums server-side, but they
 * are typed as unions plus `string` here: a value added to the enum must not
 * break a deployed bundle, so the UI narrows with the label maps below and
 * falls through to a sensible default rather than rendering nothing.
 */
export interface SupportTicket {
  id: string;
  user_id: string;
  email: string;
  name: string;
  subject: string;
  body: string;
  category: TicketCategory | string;
  urgency: number;
  blocks_transaction: boolean;
  transaction_id: string | null;
  page_path: string | null;
  stage: string | null;
  status: TicketStatus | string;
  triage: Record<string, unknown> | null;
  source: TicketSource | string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  author: MessageAuthor | string;
  body: string;
  created_at: string;
}

export interface SupportTicketThread {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

/**
 * One turn of a chat conversation handed over with the ticket. `role` is a
 * label the function renders verbatim into the stored body, so it uses the
 * same `user` / `bot` vocabulary as {@link MessageAuthor} rather than the
 * chat's own `assistant`.
 */
export interface TranscriptTurn {
  role: MessageAuthor;
  text: string;
}

/** What the caller supplies; name and email come from the session, not here. */
export interface CreateTicketInput {
  subject: string;
  body: string;
  /** The deal this is about, when the user is in one. */
  transactionId?: string;
  /** The route they were on — `/dashboard/support` unless the widget says otherwise. */
  pagePath?: string;
  /** The transaction stage they were at, when known. */
  stage?: string;
  source?: TicketSource;
  /**
   * The chat conversation behind a `source: 'chat'` ticket. It is sent as its
   * own field rather than pasted into `body`: the function appends it under a
   * header and caps that section, so the user's own words are never the part
   * cut to make room for it.
   */
  transcript?: TranscriptTurn[];
}

/**
 * The context a caller carries into the support form — passed as router state
 * by the chat widget when it hands the conversation over, so the ticket records
 * the page the user was actually stuck on rather than the support page itself.
 */
export type SupportRequestContext = Pick<CreateTicketInput, 'transactionId' | 'pagePath' | 'stage'>;

/**
 * A non-2xx from the function. `code` is the function's own `error` field
 * (`invalid_subject`, `forbidden`, `rate_limited`, …), not a prose message, so
 * the UI branches on it rather than matching strings.
 */
export class SupportTicketError extends Error {
  readonly status: number;
  readonly code: string;
  readonly resetIn?: number;
  constructor(status: number, code: string, resetIn?: number) {
    super(code);
    this.name = 'SupportTicketError';
    this.status = status;
    this.code = code;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}

async function toSupportTicketError(error: FunctionsInvokeError): Promise<SupportTicketError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; resetIn?: number } | undefined;
    return new SupportTicketError(status, typeof body?.error === 'string' ? body.error : error.message, body?.resetIn);
  } catch {
    return new SupportTicketError(status, error.message);
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('support-ticket', { body });
  if (error) throw await toSupportTicketError(error as FunctionsInvokeError);
  if (!data) throw new SupportTicketError(0, 'empty_response');
  return data;
}

/** Raise a ticket. Answers with the stored ticket, including its triage. */
export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const payload: Record<string, unknown> = {
    action: 'create',
    subject: input.subject,
    body: input.body,
    source: input.source ?? 'form',
  };
  if (input.transactionId) payload.transactionId = input.transactionId;
  if (input.pagePath) payload.pagePath = input.pagePath;
  if (input.stage) payload.stage = input.stage;
  if (input.transcript?.length) payload.transcript = input.transcript;
  const data = await invoke<{ ticket: SupportTicket }>(payload);
  return data.ticket;
}

/** The caller's own tickets, newest activity first. Server-capped at 50. */
export async function listTickets(): Promise<SupportTicket[]> {
  const data = await invoke<{ tickets: SupportTicket[] }>({ action: 'list' });
  return data.tickets ?? [];
}

/** One ticket and its thread, oldest message first. 403 if it is not yours. */
export async function getTicket(id: string): Promise<SupportTicketThread> {
  const data = await invoke<SupportTicketThread>({ action: 'get', id });
  return { ticket: data.ticket, messages: data.messages ?? [] };
}

/** Add the user's reply. Reopens the ticket and bumps it up both queues. */
export async function replyToTicket(id: string, body: string): Promise<SupportTicketMessage> {
  const data = await invoke<{ message: SupportTicketMessage }>({ action: 'reply', id, body });
  return data.message;
}

/** Close a ticket the user considers done. Answers with the closed ticket. */
export async function closeTicket(id: string): Promise<SupportTicket> {
  const data = await invoke<{ ticket: SupportTicket }>({ action: 'close', id });
  return data.ticket;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  awaiting_user: 'Awaiting your reply',
  answered: 'Answered',
  closed: 'Closed',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  account: 'Account',
  id_aml: 'ID & AML',
  forms: 'Forms',
  searches: 'Searches',
  payments: 'Payments',
  conveyancer: 'Conveyancer',
  transaction: 'Transaction',
  bug: 'Bug',
  other: 'Other',
};

/** Reads the status back to the user in their terms, not the enum's. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TicketStatus] ?? 'Open';
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as TicketCategory] ?? 'Other';
}

/** Tickets the user still owes us an answer on, for a nudge in the list. */
export function needsUserReply(ticket: SupportTicket): boolean {
  return ticket.status === 'awaiting_user';
}
