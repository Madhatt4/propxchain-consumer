// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One turn in the support chat: the user's question or the assistant's reply,
 * the pages the reply was written from, and — once per tab session — the line
 * saying this is not legal advice.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { ChatTurn } from './conversation';

/**
 * The sources the function returns are in-app routes, so they are rendered as
 * links the user can actually open rather than as opaque tags. A reply the
 * reader can check is the whole point of returning them.
 */
function sourceLabel(source: string): string {
  const [path, hash] = source.split('#');
  const segment = hash || path.split('/').filter(Boolean).pop() || 'Help';
  const words = segment.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Only a path inside this app becomes a link. The corpus ships in-app routes
 * today, but the value reaches us over the wire from a reply a prose model had
 * a hand in, so it is treated as untrusted: an absolute URL, or a
 * protocol-relative `//host`, would turn a cited source into an offsite link
 * wearing our styling. Anything else still shows — as plain text.
 */
function isInternalSource(source: string): boolean {
  return source.startsWith('/') && !source.startsWith('//');
}

const CHIP = 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium dark:bg-gray-700';

const SourceChips: React.FC<{ sources: string[] }> = ({ sources }) => (
  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Pages this answer came from">
    {sources.map((source) => (
      <li key={source}>
        {isInternalSource(source) ? (
          <Link
            to={source}
            className={`${CHIP} text-gray-700 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-600`}
          >
            {sourceLabel(source)}
          </Link>
        ) : (
          <span className={`${CHIP} text-gray-600 dark:text-gray-300`}>{sourceLabel(source)}</span>
        )}
      </li>
    ))}
  </ul>
);

const USER_BUBBLE = 'bg-blue-600 text-white';
const ASSISTANT_BUBBLE = 'bg-white text-gray-900 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

const SupportChatMessage: React.FC<{ turn: ChatTurn }> = ({ turn }) => {
  const isUser = turn.role === 'user';
  return (
    <li className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm ${isUser ? USER_BUBBLE : ASSISTANT_BUBBLE}`}>
          <span className="sr-only">{isUser ? 'You said: ' : 'PropXchain assistant said: '}</span>
          <p className="whitespace-pre-wrap break-words">{turn.text}</p>
          {!isUser && turn.sources && turn.sources.length > 0 && <SourceChips sources={turn.sources} />}
        </div>
        {turn.showDisclaimer && (
          <p className="mt-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
            General guidance about using PropXchain, not legal advice. Your conveyancer advises on your property.
          </p>
        )}
      </div>
    </li>
  );
};

export default SupportChatMessage;
