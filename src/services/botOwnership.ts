// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { BotConnectionInfo } from './botConnection.service';

/**
 * Whether the signed-in user may remove this bot.
 *
 * A bot that joined itself (OAuth consent or invite code) records the bot as
 * `addedBy` and the approving human as `ownerPrincipal`, so comparing against
 * `addedBy` hides Remove from exactly those owners. Bots added by a human
 * through connectBot carry that human as the owner. Records written before
 * owner attribution have no owner; for those the person who added the bot is
 * the only candidate.
 */
export function canRemoveBot(
  bot: Pick<BotConnectionInfo, 'addedBy' | 'ownerPrincipal'>,
  me: string | null | undefined,
): boolean {
  if (!me) return false;
  if (bot.ownerPrincipal) return bot.ownerPrincipal === me;
  return bot.addedBy === me;
}
