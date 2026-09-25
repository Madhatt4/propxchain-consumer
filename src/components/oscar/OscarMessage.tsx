import React from 'react';
import type { Message } from '../../types/oscar.types';

interface OscarMessageProps {
  message: Message;
}

export const OscarMessage: React.FC<OscarMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          isUser
            ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-br-none shadow-lg shadow-teal-500/20'
            : 'bg-white text-stone-700 rounded-bl-none shadow-sm border border-stone-100'
        }`}
      >
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
      </div>
    </div>
  );
};
