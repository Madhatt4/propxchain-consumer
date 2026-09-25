// Bot Connection Service.
//
// Read-mostly: lists bots active on a transaction and lets the user revoke
// them. Bots self-register against transactions via the @propxchain/mcp-server
// CLI's `propxchain_join_transaction_as_bot` tool, which calls the new
// transaction_manager.joinAsBotByInviteCode method on chain. The bot's
// keypair lives on the user's machine; the consumer never handles it.

import { Principal } from '@propxchain/core-client';
import { icpService } from './icp.service';

export interface BotConnectionInfo {
  principal: string;
  name: string;
  addedBy: string;
  addedAt: bigint;
}

function principalToString(p: unknown): string {
  if (p && typeof p === 'object' && 'toText' in p) {
    return (p as Principal).toText();
  }
  return String(p);
}

export const botConnectionService = {
  /** Disconnect a bot from a transaction. */
  async disconnectBot(transactionId: string, botPrincipal: string): Promise<void> {
    await icpService.initialize();
    const actor = await icpService.requireTransactionManager();

    const result = await actor.disconnectBot(
      transactionId,
      Principal.fromText(botPrincipal),
    );

    if ('err' in (result as Record<string, unknown>)) {
      throw new Error((result as { err: string }).err);
    }
  },

  /** Get all bots connected to a transaction. */
  async getTransactionBots(transactionId: string): Promise<BotConnectionInfo[]> {
    await icpService.initialize();
    const actor = await icpService.requireTransactionManager();

    const result = await actor.getTransactionBots(transactionId);

    if ('err' in (result as Record<string, unknown>)) {
      throw new Error((result as { err: string }).err);
    }

    const bots = (result as { ok: unknown[] }).ok;
    return bots.map((bot: unknown) => {
      const b = bot as Record<string, unknown>;
      return {
        principal: principalToString(b.principal),
        name: b.name as string,
        addedBy: principalToString(b.addedBy),
        addedAt: b.addedAt as bigint,
      };
    });
  },
};
