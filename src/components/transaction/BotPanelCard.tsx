// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useCallback, useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { botConnectionService, type BotConnectionInfo } from '../../services/botConnection.service';
import { assistantConnectService, describeConnectError, type AssistantGrant } from '../../services/assistantConnect.service';
import { canRemoveBot } from '../../services/botOwnership';
import { useAuthStore } from '../../stores/authStore';
import ConnectedBotItem from './ConnectedBotItem';
import ConnectAssistantSection from './ConnectAssistantSection';

interface BotPanelCardProps {
  transactionId: string;
}

interface PanelMessage {
  kind: 'ok' | 'err';
  text: string;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function loadBotsOrNull(transactionId: string): Promise<BotConnectionInfo[] | null> {
  try {
    return await botConnectionService.getTransactionBots(transactionId);
  } catch {
    return null;
  }
}

async function loadAssistantsOrEmpty(): Promise<AssistantGrant[]> {
  try {
    return await assistantConnectService.listMyActiveAssistants();
  } catch {
    return [];
  }
}

type BusyState = { action: 'add'; principal: string } | { action: 'remove' } | null;

function useBotPanel(transactionId: string) {
  const [bots, setBots] = useState<BotConnectionInfo[] | null>(null);
  const [assistants, setAssistants] = useState<AssistantGrant[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState<PanelMessage | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const [loadedBots, grants] = await Promise.all([loadBotsOrNull(transactionId), loadAssistantsOrEmpty()]);
    setBots(loadedBots);
    setAssistants(grants);
  }, [transactionId]);

  useEffect(() => void load(), [load]);

  const remove = async (bot: BotConnectionInfo): Promise<void> => {
    setBusy({ action: 'remove' });
    setMessage(null);
    try {
      await botConnectionService.disconnectBot(transactionId, bot.principal);
      setConfirming(null);
      setMessage({ kind: 'ok', text: `${bot.name} removed. This is recorded in the audit trail.` });
      await load();
    } catch (err) {
      setMessage({ kind: 'err', text: errorText(err, 'Could not remove the assistant. Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const add = async (assistant: AssistantGrant): Promise<void> => {
    setBusy({ action: 'add', principal: assistant.principal });
    setMessage(null);
    try {
      await assistantConnectService.connectToDeal(transactionId, assistant);
      setMessage({ kind: 'ok', text: `${assistant.label} added to this deal. This is recorded in the audit trail.` });
      await load();
    } catch (err) {
      const failure = describeConnectError(err);
      setMessage({ kind: failure.isAlreadyConnected ? 'ok' : 'err', text: failure.text });
      if (failure.isAlreadyConnected) await load();
    } finally {
      setBusy(null);
    }
  };

  const addingPrincipal = busy?.action === 'add' ? busy.principal : null;
  return { bots, assistants, confirming, setConfirming, isBusy: busy !== null, addingPrincipal, message, remove, add };
}

const PanelStatus: React.FC<{ message: PanelMessage }> = ({ message }) => (
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
);

type BotPanel = ReturnType<typeof useBotPanel>;

const PanelHeader: React.FC<{ hasBots: boolean }> = ({ hasBots }) => (
  <>
    <div className="flex items-center gap-2 mb-1">
      <Bot className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 font-['DM_Sans']">AI assistants</h3>
    </div>
    <p className="text-xs text-stone-500 dark:text-stone-400 mb-3 font-['DM_Sans']">
      {hasBots ? 'Assistants connected to this transaction.' : 'No assistants are connected to this transaction.'}
    </p>
  </>
);

const ConnectedBotList: React.FC<{ panel: BotPanel; bots: BotConnectionInfo[]; me: string }> = ({ panel, bots, me }) => (
  <ul className="space-y-2">
    {bots.map((bot) => (
      <ConnectedBotItem
        key={bot.principal}
        bot={bot}
        me={me}
        canRemove={canRemoveBot(bot, me)}
        isConfirming={panel.confirming === bot.principal}
        isBusy={panel.isBusy}
        onAskRemove={() => panel.setConfirming(bot.principal)}
        onCancel={() => panel.setConfirming(null)}
        onRemove={() => void panel.remove(bot)}
      />
    ))}
  </ul>
);

const BotPanelCard: React.FC<BotPanelCardProps> = ({ transactionId }) => {
  const me = useAuthStore((s) => s.principalId);
  const panel = useBotPanel(transactionId);

  if (!me || panel.bots === null) return null;
  const connected = new Set(panel.bots.map((b) => b.principal));
  const notYetConnected = panel.assistants.filter((a) => !connected.has(a.principal));
  const isEveryAssistantConnected = panel.assistants.length > 0 && notYetConnected.length === 0;

  return (
    <div
      className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#0c1424] p-4"
      data-testid="bot-panel"
    >
      <PanelHeader hasBots={panel.bots.length > 0} />
      {panel.message && <PanelStatus message={panel.message} />}
      {panel.bots.length > 0 && <ConnectedBotList panel={panel} bots={panel.bots} me={me} />}
      {!isEveryAssistantConnected && (
        <ConnectAssistantSection
          assistants={notYetConnected}
          addingPrincipal={panel.addingPrincipal}
          isBusy={panel.isBusy}
          onAdd={(a) => void panel.add(a)}
        />
      )}
    </div>
  );
};

export default BotPanelCard;
