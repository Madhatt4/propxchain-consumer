import { Principal } from '@propxchain/core-client';
import type { UserManagementService } from '@propxchain/core-client';
import { icpService } from './icp.service';

type AgentGrant = Awaited<ReturnType<UserManagementService['getMyAgentGrants']>>[number];
type BotRole = Parameters<UserManagementService['registerBot']>[3];

export interface AssistantGrant {
  principal: string;
  label: string;
}

const PERSONAL_ROLE: BotRole = { BotPersonal: null };
const NANOS_PER_MS = 1_000_000n;
const KNOWN_CLIENTS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /claude|anthropic/i, label: 'claude.ai' },
  { pattern: /chatgpt|openai/i, label: 'ChatGPT' },
];
export const INACTIVE_ASSISTANT_MESSAGE =
  'This assistant is switched off on your account. Switch it back on in your AI assistant settings, then try again.';

export function assistantLabel(clientId: string | null): string {
  if (!clientId) return 'AI assistant';
  return KNOWN_CLIENTS.find((c) => c.pattern.test(clientId))?.label ?? 'AI assistant';
}

export function isUsableGrant(grant: AgentGrant, nowMs: number): boolean {
  if (!('active' in grant.status)) return false;
  const expiresAt = grant.expiresAt[0];
  return expiresAt === undefined || expiresAt > BigInt(nowMs) * NANOS_PER_MS;
}

function unwrap<T>(result: { ok: T } | { err: string }): T {
  if ('err' in result) throw new Error(result.err);
  return result.ok;
}

export const assistantConnectService = {
  async listMyActiveAssistants(nowMs: number = Date.now()): Promise<AssistantGrant[]> {
    const actor = await icpService.requireUserManagement();
    const grants = await actor.getMyAgentGrants();
    return grants
      .filter((g) => isUsableGrant(g, nowMs))
      .map((g) => ({ principal: g.agentPrincipal.toText(), label: assistantLabel(g.clientId[0] ?? null) }));
  },

  async ensureRegistered(principal: string, name: string): Promise<void> {
    const actor = await icpService.requireUserManagement();
    const bot = Principal.fromText(principal);
    const existing = (await actor.getBotAgent(bot))[0];
    if (existing) {
      if (!existing.isActive) throw new Error(INACTIVE_ASSISTANT_MESSAGE);
      return;
    }
    unwrap(await actor.registerBot(bot, name, 'Connected from the deal page', PERSONAL_ROLE));
  },

  async connectToDeal(transactionId: string, assistant: AssistantGrant): Promise<void> {
    const name = `${assistant.label} assistant`;
    await assistantConnectService.ensureRegistered(assistant.principal, name);
    const actor = await icpService.requireTransactionManager();
    unwrap(await actor.connectBot(transactionId, Principal.fromText(assistant.principal), name));
  },
};
