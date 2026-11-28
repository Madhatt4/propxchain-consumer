// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Loader2, Unplug } from 'lucide-react';
import type { BotConnectionInfo } from '../../services/botConnection.service';

interface ConnectedBotItemProps {
  bot: BotConnectionInfo;
  me: string | null;
  canRemove: boolean;
  isConfirming: boolean;
  isBusy: boolean;
  onAskRemove: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

function formatJoined(nanos: bigint): string {
  const ms = Number(nanos) / 1_000_000;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ownerText(bot: BotConnectionInfo, me: string | null): string {
  if (!bot.ownerPrincipal) return 'Owner: not recorded';
  return bot.ownerPrincipal === me ? 'Owner: you' : 'Owner: someone else';
}

interface RemoveConfirmProps {
  name: string;
  isBusy: boolean;
  onCancel: () => void;
  onRemove: () => void;
}

const RemoveConfirm: React.FC<RemoveConfirmProps> = ({ name, isBusy, onCancel, onRemove }) => (
  <div className="mt-3 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-xs text-stone-800 dark:text-stone-200 font-['DM_Sans']">
    <p className="font-semibold mb-1">Remove {name} from this transaction?</p>
    <ul className="list-disc pl-4 space-y-0.5 mb-2">
      <li>It loses access to this transaction straight away.</li>
      <li>Your other transactions are not affected.</li>
      <li>You can add it again from this page.</li>
      <li>The removal is recorded in the audit trail under your name.</li>
    </ul>
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={onRemove}
        className="inline-flex items-center gap-1 rounded-md bg-red-600 text-white px-2.5 py-1 disabled:opacity-60"
      >
        {isBusy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />} Remove assistant
      </button>
      <button
        type="button"
        disabled={isBusy}
        onClick={onCancel}
        className="rounded-md border border-stone-300 dark:border-stone-600 px-2.5 py-1"
      >
        Keep it
      </button>
    </div>
  </div>
);

const ConnectedBotItem: React.FC<ConnectedBotItemProps> = ({
  bot, me, canRemove, isConfirming, isBusy, onAskRemove, onCancel, onRemove,
}) => (
  <li className="rounded-lg border border-stone-200 dark:border-stone-700 p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 break-words font-['DM_Sans']">{bot.name}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400 font-['DM_Sans']">
          {ownerText(bot, me)}
          {' · joined '}
          {formatJoined(bot.addedAt)}
        </p>
      </div>
      {canRemove ? (
        <button
          type="button"
          onClick={onAskRemove}
          className="shrink-0 inline-flex items-center gap-1 text-xs rounded-md border border-red-600/50 text-red-600 dark:text-red-400 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/30"
        >
          <Unplug className="w-3.5 h-3.5" aria-hidden="true" /> Remove
        </button>
      ) : (
        <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400 font-['DM_Sans']">Only its owner can remove it</span>
      )}
    </div>
    {isConfirming && <RemoveConfirm name={bot.name} isBusy={isBusy} onCancel={onCancel} onRemove={onRemove} />}
  </li>
);

export default ConnectedBotItem;
