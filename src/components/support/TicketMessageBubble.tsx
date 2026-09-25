// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One turn of a support ticket thread. The person whose ticket it is sits on
 * the right, PropXchain on the left, and anything the assistant said is muted
 * so it never reads as a member of staff having already answered.
 *
 * Shared by the customer's ticket screen and the admin support desk. Only the
 * attribution differs — the customer sees "You", the desk sees "Customer" —
 * so that is a prop and everything else is fixed. An admin is then looking at
 * the same thread the customer is.
 */
import React from 'react';
import { formatWhen } from './TicketChrome';
import { CUSTOMER_AUTHOR_LABELS, type TicketBubble } from './ticketThread';

interface TicketMessageBubbleProps {
  bubble: TicketBubble;
  authorLabels?: Readonly<Record<string, string>>;
}

const TicketMessageBubble: React.FC<TicketMessageBubbleProps> = ({
  bubble,
  authorLabels = CUSTOMER_AUTHOR_LABELS,
}) => {
  const fromTicketOwner = bubble.author === 'user';
  const fromBot = bubble.author === 'bot';
  const tone = fromTicketOwner
    ? 'bg-blue-600 text-white'
    : fromBot
      ? 'bg-gray-100 italic text-gray-600 dark:bg-gray-900 dark:text-gray-400'
      : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100';

  return (
    <div className={`flex ${fromTicketOwner ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-4 py-3 ${tone}`}>
        <p
          className={`mb-1 text-xs font-semibold ${
            fromTicketOwner ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {authorLabels[bubble.author] ?? 'PropXchain support'} · {formatWhen(bubble.created_at)}
        </p>
        <p className="whitespace-pre-wrap text-sm">{bubble.body}</p>
      </div>
    </div>
  );
};

export default TicketMessageBubble;
