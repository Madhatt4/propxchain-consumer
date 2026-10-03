// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Unplug } from 'lucide-react';
import { botConnectionService, type BotConnectionInfo } from '../../services/botConnection.service';
import { canRemoveBot } from '../../services/botOwnership';
import { useAuthStore } from '../../stores/authStore';

interface BotPanelCardProps {
  transactionId: string;
}

function formatJoined(nanos: bigint): string {
  const ms = Number(nanos) / 1_000_000;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * AI assistants connected to this transaction, with a Remove button for the
 * bots the signed-in user owns. Renders nothing while loading or when no bot
 * is connected, so a deal without assistants shows no extra card.
 */
const BotPanelCard: React.FC<BotPanelCardProps> = ({ transactionId }) => {
  const me = useAuthStore((s) => s.principalId);
  const [bots, setBots] = useState<BotConnectionInfo[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setBots(await botConnectionService.getTransactionBots(transactionId));
    } catch {
      // The caller may not be on the access list, or the canister may be
      // unreachable. The card stays hidden rather than showing an error on
      // a page that works without it.
      setBots([]);
    }
  }, [transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (bot: BotConnectionInfo): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await botConnectionService.disconnectBot(transactionId, bot.principal);
      setConfirming(null);
      setMessage({ kind: 'ok', text: `${bot.name} removed. This is recorded in the audit trail.` });
      await load();
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Could not remove the assistant. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (bots.length === 0 && !message) return null;

  return (
    <div
      className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#0c1424] p-4"
      data-testid="bot-panel"
    >
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 font-['DM_Sans']">AI assistants</h3>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-3 font-['DM_Sans']">
        Assistants connected to this transaction.
      </p>

      {message && (
        <p
          role="status"
          className={`text-xs rounded-md px-2.5 py-2 mb-3 font-['DM_Sans'] ${
            message.kind === 'ok'
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {message.text}
        </p>
      )}

      <ul className="space-y-2">
        {bots.map((bot) => {
          const mine = canRemoveBot(bot, me);
          return (
            <li key={bot.principal} className="rounded-lg border border-stone-200 dark:border-stone-700 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100 break-words font-['DM_Sans']">{bot.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-['DM_Sans']">
                    {bot.ownerPrincipal && bot.ownerPrincipal === me ? 'Owner: you' : 'Owner: someone else'}
                    {' · joined '}
                    {formatJoined(bot.addedAt)}
                  </p>
                </div>
                {mine ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(bot.principal)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs rounded-md border border-red-600/50 text-red-600 dark:text-red-400 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <Unplug className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400 font-['DM_Sans']">Only its owner can remove it</span>
                )}
              </div>

              {confirming === bot.principal && (
                <div className="mt-3 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-xs text-stone-800 dark:text-stone-200 font-['DM_Sans']">
                  <p className="font-semibold mb-1">Remove {bot.name} from this transaction?</p>
                  <ul className="list-disc pl-4 space-y-0.5 mb-2">
                    <li>It loses access to this transaction straight away.</li>
                    <li>Your other transactions are not affected.</li>
                    <li>It can rejoin with a new invite code.</li>
                    <li>The removal is recorded in the audit trail under your name.</li>
                  </ul>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(bot)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 text-white px-2.5 py-1 disabled:opacity-60"
                    >
                      {busy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />} Remove assistant
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                      className="rounded-md border border-stone-300 dark:border-stone-600 px-2.5 py-1"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BotPanelCard;
