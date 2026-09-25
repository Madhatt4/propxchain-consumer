// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The chat widget's state: the conversation, the draft, and the handover to a
 * ticket. The panel is presentational and reads all of it from here.
 *
 * The hook lives in the widget rather than the panel so the conversation
 * survives the panel being closed and reopened on the same page. Closing a
 * chat is not the same as abandoning the question.
 */
import { useCallback, useRef, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  type ChatContext,
  chatErrorMessage,
  sendChatMessage,
} from '../../services/supportChat.service';
import { SupportTicketError, createTicket } from '../../services/supportTicket.service';
import { clearDraft, hasShownDisclaimer, markDisclaimerShown, readDraft, writeDraft } from './chatSession';
import {
  type ChatTurn,
  TURNS_BEFORE_TICKET_OFFER,
  ticketBody,
  ticketSubject,
  ticketTranscript,
  toMessages,
  userTurnCount,
} from './conversation';

export interface SupportChat {
  turns: ChatTurn[];
  draft: string;
  setDraft: (text: string) => void;
  sending: boolean;
  /** What went wrong on the last send, in the user's terms. */
  error: string | null;
  /** True once the reply asks for a person, or the conversation has run long. */
  showTicketOffer: boolean;
  creatingTicket: boolean;
  ticketError: string | null;
  send: () => Promise<void>;
  /** Raises the ticket and answers with its id, or null if it could not. */
  openTicket: () => Promise<string | null>;
  /**
   * Drop both failure messages. Called when the panel closes: an error is
   * about the attempt that just failed, and reopening later to be greeted by
   * it reads as a fresh fault that has not happened.
   */
  clearErrors: () => void;
}

export function useSupportChat(context: ChatContext): SupportChat {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraftState] = useState<string>(() => readDraft());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestTicket, setSuggestTicket] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const nextId = useRef(0);

  const makeTurn = useCallback((turn: Omit<ChatTurn, 'id'>): ChatTurn => {
    nextId.current += 1;
    return { ...turn, id: `turn-${nextId.current}` };
  }, []);

  const setDraft = useCallback((text: string): void => {
    setDraftState(text);
    writeDraft(text);
  }, []);

  const clearErrors = useCallback((): void => {
    setError(null);
    setTicketError(null);
  }, []);

  const send = useCallback(async (): Promise<void> => {
    const text = draft.trim();
    if (!text || sending) return;
    const asked = makeTurn({ role: 'user', text });
    const history = [...turns, asked];
    setTurns(history);
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const reply = await sendChatMessage(toMessages(history), context);
      // The disclaimer rides on the first answer of the tab session, not on
      // every one — repeated on each reply it becomes furniture nobody reads.
      const first = !hasShownDisclaimer();
      if (first) markDisclaimerShown();
      setTurns([...history, makeTurn({ role: 'assistant', text: reply.reply, sources: reply.sources, showDisclaimer: first })]);
      setSuggestTicket(reply.suggestTicket);
    } catch (e) {
      logger.error('Support chat send failed:', e);
      // The question stays on screen: it is the thing they would have to retype.
      setError(chatErrorMessage(e));
    } finally {
      setSending(false);
    }
  }, [context, draft, makeTurn, sending, setDraft, turns]);

  const openTicket = useCallback(async (): Promise<string | null> => {
    if (creatingTicket || turns.length === 0) return null;
    setCreatingTicket(true);
    setTicketError(null);
    try {
      const ticket = await createTicket({
        subject: ticketSubject(turns),
        body: ticketBody(turns),
        transcript: ticketTranscript(turns),
        source: 'chat',
        pagePath: context.pagePath,
        transactionId: context.transactionId,
        stage: context.stage,
      });
      clearDraft();
      return ticket.id;
    } catch (e) {
      logger.error('Could not raise a ticket from the chat:', e);
      const rateLimited = e instanceof SupportTicketError && e.code === 'rate_limited';
      setTicketError(
        rateLimited
          ? 'You have raised a few tickets just now. Give it a moment and try again.'
          : 'We could not open a ticket. Try again, or use the support form.',
      );
      return null;
    } finally {
      setCreatingTicket(false);
    }
  }, [context, creatingTicket, turns]);

  return {
    turns,
    draft,
    setDraft,
    sending,
    error,
    showTicketOffer: suggestTicket || userTurnCount(turns) >= TURNS_BEFORE_TICKET_OFFER,
    creatingTicket,
    ticketError,
    send,
    openTicket,
    clearErrors,
  };
}
