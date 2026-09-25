// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The floating help button, bottom right of every signed-in dashboard page.
 *
 * Mounted once, inside the router in `App.tsx`, rather than dropped into each
 * page: this repo has no dashboard layout component to hang it off, and eight
 * copies of a widget is eight places for one to go stale. It decides for
 * itself whether the current route is one it belongs on.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ChatContext } from '../../services/supportChat.service';
import { useActiveTransactionStore } from '../../stores/activeTransactionStore';
import { useAuthStore } from '../../stores/authStore';
import { isDashboardPath } from './chatRoutes';
import SupportChatPanel from './SupportChatPanel';
import { useSupportChat } from './useSupportChat';

const SupportChatWidget: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const transactionId = useActiveTransactionStore((s) => s.transactionId);
  const stage = useActiveTransactionStore((s) => s.stage);
  const [isOpen, setIsOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const context = useMemo<ChatContext>(
    () => ({
      pagePath: location.pathname,
      ...(transactionId ? { transactionId } : {}),
      ...(transactionId && stage ? { stage } : {}),
    }),
    [location.pathname, stage, transactionId],
  );

  const chat = useSupportChat(context);

  // Focus goes back to the button that opened the panel, so a keyboard user is
  // not dropped at the top of the page. The conversation is kept — closing a
  // chat is not abandoning the question — but the failure messages are not: an
  // error describes an attempt that is over, and being greeted by it on the
  // next open reads as a fresh fault that has not happened.
  const { clearErrors } = chat;
  const handleClose = useCallback((): void => {
    setIsOpen(false);
    clearErrors();
    launcherRef.current?.focus();
  }, [clearErrors]);

  const handleTicketCreated = useCallback(
    (ticketId: string): void => {
      setIsOpen(false);
      navigate(`/dashboard/support/tickets/${ticketId}`);
    },
    [navigate],
  );

  if (!isAuthenticated || !isDashboardPath(location.pathname)) return null;

  return (
    <>
      {isOpen && <SupportChatPanel chat={chat} onClose={handleClose} onTicketCreated={handleTicketCreated} />}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        aria-label={isOpen ? 'Close help chat' : 'Open help chat'}
        aria-expanded={isOpen}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          {isOpen ? '✕' : '?'}
        </span>
      </button>
    </>
  );
};

export default SupportChatWidget;
