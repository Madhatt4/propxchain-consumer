// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The reply box on the support desk. Sending writes the message and emails the
 * customer — the function does both — so the confirmation names the address it
 * went to. An admin who cannot see where a reply landed has no way of knowing
 * the email half happened at all, which is the gap that made replies from the
 * DevOps board silently email nobody.
 *
 * The box is remounted per ticket by its caller, so the draft and the
 * confirmation never follow the admin onto the next ticket in the queue.
 */
import React, { useState } from 'react';
import { MAX_REPLY_BODY } from '../../../services/supportAdmin.service';

interface AdminReplyBoxProps {
  /** Where the function will email this reply: the address on the ticket. */
  email: string;
  disabled: boolean;
  /** Resolves when the reply is stored; rejects to leave the draft in place. */
  onSend: (body: string) => Promise<void>;
}

const AdminReplyBox: React.FC<AdminReplyBoxProps> = ({ email, disabled, onSend }) => {
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setBody('');
      setHasSent(true);
    } catch {
      // The caller surfaces the error; the draft stays so it is not retyped.
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="admin-reply" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Reply to the customer
      </label>
      <textarea
        id="admin-reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={MAX_REPLY_BODY}
        disabled={disabled}
        placeholder="Answer in plain English. This is emailed to the customer as well as added to the thread."
        className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={disabled || isSending || body.trim().length === 0}
          className="min-h-[44px] rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send reply'}
        </button>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {hasSent ? `Emailed to ${email}` : `Will be emailed to ${email}`}
        </p>
      </div>
    </form>
  );
};

export default AdminReplyBox;
