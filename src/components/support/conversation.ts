// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The chat conversation as data: the turn the panel renders, and the pure
 * functions that turn a conversation into a support ticket.
 *
 * Kept apart from the hook so the handover — what becomes the subject, what
 * becomes the user's own words, what becomes the transcript — is testable
 * without rendering anything.
 */
import type { ChatMessage, ChatRole } from '../../services/supportChat.service';
import { MAX_SUBJECT, type TranscriptTurn } from '../../services/supportTicket.service';

/** The function rejects a transcript longer than this rather than trimming it. */
export const MAX_TRANSCRIPT_TURNS = 200;

/** Offer a person once the conversation has run this long, reply or no reply. */
export const TURNS_BEFORE_TICKET_OFFER = 3;

/**
 * One rendered turn. `sources` and `showDisclaimer` are display state the wire
 * format has no room for, which is why this is not `ChatMessage`.
 */
export interface ChatTurn {
  id: string;
  role: ChatRole;
  text: string;
  /** Help-corpus keys behind an assistant reply, shown as chips. */
  sources?: string[];
  /** Set on the one assistant turn that carries the "not legal advice" line. */
  showDisclaimer?: boolean;
}

/** The wire view of the conversation: role and text, nothing else. */
export function toMessages(turns: ChatTurn[]): ChatMessage[] {
  return turns.map((turn) => ({ role: turn.role, text: turn.text }));
}

/** How many times the user has spoken — the count the ticket offer is timed off. */
export function userTurnCount(turns: ChatTurn[]): number {
  return turns.filter((turn) => turn.role === 'user').length;
}

function firstUserText(turns: ChatTurn[]): string {
  return turns.find((turn) => turn.role === 'user')?.text.trim() ?? '';
}

/**
 * The subject: the user's opening question on one line, capped.
 *
 * Their own words rather than a summary of them — a generated subject would be
 * the one line the support queue sorts and searches on, and getting it subtly
 * wrong is worse than a long quote.
 */
export function ticketSubject(turns: ChatTurn[]): string {
  const opening = firstUserText(turns).replace(/\s+/g, ' ').trim();
  if (opening.length === 0) return 'Support request from chat';
  return opening.length <= MAX_SUBJECT ? opening : `${opening.slice(0, MAX_SUBJECT - 1)}…`;
}

/**
 * The body: the user's opening question again, in full.
 *
 * The function appends the transcript under its own header and never cuts the
 * body to make room, so the thing a human reads first is what the person
 * actually asked, not the middle of a conversation with a bot.
 */
export function ticketBody(turns: ChatTurn[]): string {
  return firstUserText(turns) || 'Raised from the support chat.';
}

/**
 * The conversation as the ticket function's transcript. `assistant` becomes
 * `bot` because the function renders the role verbatim into the stored body
 * and the ticket thread already calls our side `bot`.
 */
export function ticketTranscript(turns: ChatTurn[]): TranscriptTurn[] {
  return turns
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map((turn) => ({ role: turn.role === 'user' ? ('user' as const) : ('bot' as const), text: turn.text }));
}
