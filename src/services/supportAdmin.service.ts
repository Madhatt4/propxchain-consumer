// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The admin side of a support ticket: the typed client for the
 * monorepo-owned `support-admin` edge function (not one of this repo's own
 * `supabase/functions/`). Four actions — list, get, reply, set_status.
 *
 * Why this exists rather than a Supabase query: replying and closing email the
 * customer. Both notices are sent by the function, so a reply written straight
 * into `support_ticket_messages` would land in the dashboard and nowhere else.
 * The function also owns the status move that takes an answered ticket out of
 * the queue.
 *
 * Who may call it is decided server-side — the function gates on the verified
 * session email and answers 403 to everyone else. The admin route gate in this
 * repo only decides which screens to render, never what the caller may read.
 */
import { supabase } from '../lib/supabase';
import type { SupportTicket, SupportTicketMessage, TicketStatus } from './supportTicket.service';

/** Mirrors `support-admin/request.ts`, so a doomed request fails here first. */
export const MAX_REPLY_BODY = 5000;
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;

/** A queue row: the ticket plus how many replies are already on it. */
export interface AdminTicketSummary extends SupportTicket {
  message_count: number;
}

export interface AdminTicketThread {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

/**
 * What a reply leaves behind: the stored message, and the status the function
 * parked the ticket in. The status is returned rather than assumed so the
 * queue row can be corrected without a re-read.
 */
export interface AdminReplyResult {
  message: SupportTicketMessage;
  status: TicketStatus | string;
}

export interface ListTicketsOptions {
  /** Omitted means every status — the desk filters the queue itself. */
  status?: TicketStatus;
  limit?: number;
}

/**
 * A non-2xx from the function. `code` is the function's own `error` field
 * (`forbidden`, `not_found`, `invalid_body`, `rate_limited`, …), not a prose
 * message, so the UI branches on it rather than matching strings.
 */
export class SupportAdminError extends Error {
  readonly status: number;
  readonly code: string;
  readonly resetIn?: number;
  constructor(status: number, code: string, resetIn?: number) {
    super(code);
    this.name = 'SupportAdminError';
    this.status = status;
    this.code = code;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}

async function toSupportAdminError(error: FunctionsInvokeError): Promise<SupportAdminError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; resetIn?: number } | undefined;
    return new SupportAdminError(status, typeof body?.error === 'string' ? body.error : error.message, body?.resetIn);
  } catch {
    return new SupportAdminError(status, error.message);
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('support-admin', { body });
  if (error) throw await toSupportAdminError(error as FunctionsInvokeError);
  if (!data) throw new SupportAdminError(0, 'empty_response');
  return data;
}

/**
 * The whole queue, most urgent first then most recently active. Every status
 * unless one is named: the desk shows several at once, which the function's
 * single-status filter cannot express, so the filtering happens client-side
 * off one read.
 */
export async function listAdminTickets(options: ListTicketsOptions = {}): Promise<AdminTicketSummary[]> {
  const payload: Record<string, unknown> = { action: 'list', limit: options.limit ?? DEFAULT_LIST_LIMIT };
  if (options.status) payload.status = options.status;
  const data = await invoke<{ tickets: AdminTicketSummary[] }>(payload);
  return data.tickets ?? [];
}

/** One ticket and its thread, oldest message first. */
export async function getAdminTicket(id: string): Promise<AdminTicketThread> {
  const data = await invoke<AdminTicketThread>({ action: 'get', id });
  return { ticket: data.ticket, messages: data.messages ?? [] };
}

/**
 * Answer the customer. The function writes the message, parks the ticket in
 * `awaiting_user` and emails the address on the ticket.
 */
export async function replyToAdminTicket(id: string, body: string): Promise<AdminReplyResult> {
  const data = await invoke<AdminReplyResult>({ action: 'reply', id, body });
  return { message: data.message, status: data.status ?? 'awaiting_user' };
}

/** Move a ticket by hand. Closing it is the only move the customer is emailed about. */
export async function setTicketStatus(id: string, status: TicketStatus): Promise<SupportTicket> {
  const data = await invoke<{ ticket: SupportTicket }>({ action: 'set_status', id, status });
  return data.ticket;
}
