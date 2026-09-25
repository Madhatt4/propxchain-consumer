// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The chat panel itself: the conversation, the box to type in, and the offer
 * of a person when the bot is not getting there.
 *
 * Presentational — every piece of state comes from `useSupportChat`, which the
 * widget owns so a closed panel does not lose the conversation.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { MAX_MESSAGE_CHARS } from '../../services/supportChat.service';
import SupportChatMessage from './SupportChatMessage';
import type { SupportChat } from './useSupportChat';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TITLE_ID = 'support-chat-title';

interface SupportChatPanelProps {
  chat: SupportChat;
  onClose: () => void;
  /** Called with the new ticket's id once the conversation has been handed over. */
  onTicketCreated: (ticketId: string) => void;
}

const Greeting: React.FC = () => (
  <li className="rounded-lg bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">
    Ask me about using PropXchain — your pack, forms, searches, payments or where your move is up to. If I cannot help,
    I will open a ticket for you.
  </li>
);

const TicketOffer: React.FC<{ chat: SupportChat; onTicketCreated: (id: string) => void }> = ({ chat, onTicketCreated }) => {
  const handleClick = useCallback(async (): Promise<void> => {
    const id = await chat.openTicket();
    if (id) onTicketCreated(id);
  }, [chat, onTicketCreated]);

  return (
    <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={chat.creatingTicket}
        className="min-h-11 w-full rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/30"
      >
        {chat.creatingTicket ? 'Opening a ticket…' : 'Open a ticket with this conversation'}
      </button>
      {chat.ticketError && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{chat.ticketError}</p>}
    </div>
  );
};

const Composer: React.FC<{ chat: SupportChat; inputRef: React.RefObject<HTMLTextAreaElement> }> = ({ chat, inputRef }) => {
  // Enter sends, Shift+Enter starts a line. A support question is usually one
  // sentence, and a send button that needs the mouse costs more than the
  // occasional unintended send does.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void chat.send();
    }
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-gray-200 p-3 dark:border-gray-700"
      onSubmit={(e) => {
        e.preventDefault();
        void chat.send();
      }}
    >
      <label htmlFor="support-chat-input" className="sr-only">
        Your message
      </label>
      <textarea
        id="support-chat-input"
        ref={inputRef}
        rows={2}
        value={chat.draft}
        maxLength={MAX_MESSAGE_CHARS}
        onChange={(e) => chat.setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question…"
        className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <button
        type="submit"
        disabled={chat.sending || chat.draft.trim().length === 0}
        className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {chat.sending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
};

const SupportChatPanel: React.FC<SupportChatPanelProps> = ({ chat, onClose, onTicketCreated }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [chat.turns, chat.sending]);

  /** Escape closes; Tab cycles inside the panel rather than out into the page. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      // Deliberately NOT aria-modal. There is no backdrop and the page behind
      // stays usable, so claiming modality would tell a screen reader the rest
      // of the page is inert when it is not. Cycling Tab inside the panel is a
      // focus convenience, not modality — adding an overlay to make the claim
      // true would put a help widget in front of the work it is helping with.
      aria-labelledby={TITLE_ID}
      onKeyDown={handleKeyDown}
      className="fixed bottom-20 right-4 z-50 flex max-h-[min(32rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
        <h2 id={TITLE_ID} className="text-sm font-semibold text-gray-900 dark:text-white">
          PropXchain help
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close help chat"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <ul className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {chat.turns.length === 0 && <Greeting />}
        {chat.turns.map((turn) => (
          <SupportChatMessage key={turn.id} turn={turn} />
        ))}
        {chat.sending && <li className="text-xs text-gray-500 dark:text-gray-400">Thinking…</li>}
        {chat.error && (
          <li className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {chat.error}
          </li>
        )}
        <li ref={endRef} aria-hidden="true" className="list-none" />
      </ul>

      {chat.showTicketOffer && <TicketOffer chat={chat} onTicketCreated={onTicketCreated} />}
      <Composer chat={chat} inputRef={inputRef} />
    </div>
  );
};

export default SupportChatPanel;
