// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Principal } from '@propxchain/core-client';

const getMyAgentGrants = vi.fn();
const getBotAgent = vi.fn();
const registerBot = vi.fn();
const connectBot = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: {
    requireUserManagement: async () => ({ getMyAgentGrants, getBotAgent, registerBot }),
    requireTransactionManager: async () => ({ connectBot }),
  },
}));

import {
  assistantConnectService,
  assistantLabel,
  describeConnectError,
  INACTIVE_ASSISTANT_MESSAGE,
} from '../assistantConnect.service';

const NOW_MS = 1_800_000_000_000;
const NOW_NS = BigInt(NOW_MS) * 1_000_000n;
const agent = Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4]));
const otherAgent = Principal.fromUint8Array(new Uint8Array([5, 6, 7, 8]));

function grant(overrides: Record<string, unknown> = {}) {
  return {
    agentPrincipal: agent,
    status: { active: null },
    expiresAt: [],
    clientId: ['claude-ai-client'],
    source: { oauth: null },
    ownerPrincipal: [Principal.fromUint8Array(new Uint8Array([9]))],
    scopes: [],
    tier: { readOnly: null },
    issuedAt: 0n,
    lastElevatedAt: [],
    ...overrides,
  };
}

describe('assistantConnectService.listMyActiveAssistants', () => {
  beforeEach(() => getMyAgentGrants.mockReset());

  it('should return an active, unexpired grant labelled from its client id', async () => {
    getMyAgentGrants.mockResolvedValue([grant({ expiresAt: [NOW_NS + 1n] })]);
    const result = await assistantConnectService.listMyActiveAssistants(NOW_MS);
    expect(result).toEqual([{ principal: agent.toText(), label: 'claude.ai' }]);
  });

  it('should offer an active grant that has no expiry date', async () => {
    getMyAgentGrants.mockResolvedValue([grant({ expiresAt: [] })]);
    const result = await assistantConnectService.listMyActiveAssistants(NOW_MS);
    expect(result).toEqual([{ principal: agent.toText(), label: 'claude.ai' }]);
  });

  it('should drop revoked, pre-claim and expired grants', async () => {
    getMyAgentGrants.mockResolvedValue([
      grant({ status: { revoked: null } }),
      grant({ status: { preClaim: null } }),
      grant({ agentPrincipal: otherAgent, expiresAt: [NOW_NS - 1n] }),
    ]);
    const result = await assistantConnectService.listMyActiveAssistants(NOW_MS);
    expect(result).toEqual([]);
  });

  it('should fall back to a generic label when the client is unknown or missing', () => {
    expect(assistantLabel(null)).toBe('AI assistant');
    expect(assistantLabel('some-other-client')).toBe('AI assistant');
    expect(assistantLabel('chatgpt-connector')).toBe('ChatGPT');
  });
});

describe('assistantConnectService.connectToDeal', () => {
  const assistant = { principal: agent.toText(), label: 'claude.ai' };

  beforeEach(() => {
    getBotAgent.mockReset();
    registerBot.mockReset();
    connectBot.mockReset().mockResolvedValue({ ok: null });
  });

  it('should register the assistant as a personal bot when it is not registered, then connect it', async () => {
    getBotAgent.mockResolvedValue([]);
    registerBot.mockResolvedValue({ ok: {} });
    await assistantConnectService.connectToDeal('tx1', assistant);
    expect(registerBot).toHaveBeenCalledWith(agent, 'claude.ai assistant', expect.any(String), { BotPersonal: null });
    expect(connectBot).toHaveBeenCalledWith('tx1', agent, 'claude.ai assistant');
  });

  it('should skip registration when the assistant is already registered and active', async () => {
    getBotAgent.mockResolvedValue([{ isActive: true }]);
    await assistantConnectService.connectToDeal('tx1', assistant);
    expect(registerBot).not.toHaveBeenCalled();
    expect(connectBot).toHaveBeenCalledWith('tx1', agent, 'claude.ai assistant');
  });

  it('should refuse without reactivating when the registered assistant is inactive', async () => {
    getBotAgent.mockResolvedValue([{ isActive: false }]);
    await expect(assistantConnectService.connectToDeal('tx1', assistant)).rejects.toThrow(INACTIVE_ASSISTANT_MESSAGE);
    expect(registerBot).not.toHaveBeenCalled();
    expect(connectBot).not.toHaveBeenCalled();
  });

  it('should surface the registerBot error text and not connect', async () => {
    getBotAgent.mockResolvedValue([]);
    registerBot.mockResolvedValue({ err: 'Bot principal is already registered' });
    await expect(assistantConnectService.connectToDeal('tx1', assistant)).rejects.toThrow('Bot principal is already registered');
    expect(connectBot).not.toHaveBeenCalled();
  });

  it('should surface the connectBot error text', async () => {
    getBotAgent.mockResolvedValue([{ isActive: true }]);
    connectBot.mockResolvedValue({ err: 'Only transaction participants can connect a bot' });
    await expect(assistantConnectService.connectToDeal('tx1', assistant)).rejects.toThrow('Only transaction participants can connect a bot');
  });
});

describe('describeConnectError', () => {
  it('should say the assistant belongs to another account when the bot is already registered', () => {
    const failure = describeConnectError(new Error('Bot principal is already registered'));
    expect(failure).toEqual({
      isAlreadyConnected: false,
      text: "This assistant is linked to a different PropXchain account, so it can't be added here.",
    });
  });

  it('should treat an already connected bot as already on the deal', () => {
    const failure = describeConnectError(new Error('Bot is already connected to this transaction'));
    expect(failure).toEqual({ isAlreadyConnected: true, text: 'That assistant is already on this deal.' });
  });

  it('should say only people on the deal can add an assistant when the caller is not a participant', () => {
    const failure = describeConnectError(new Error('Only transaction participants can connect a bot'));
    expect(failure).toEqual({ isAlreadyConnected: false, text: 'Only people on this deal can add an assistant.' });
  });

  it('should keep the switched-off message as written', () => {
    const failure = describeConnectError(new Error(INACTIVE_ASSISTANT_MESSAGE));
    expect(failure).toEqual({ isAlreadyConnected: false, text: INACTIVE_ASSISTANT_MESSAGE });
  });

  it('should fall back to a generic retry message for an unknown error or a non-Error value', () => {
    const fallback = { isAlreadyConnected: false, text: "Couldn't add the assistant. Please try again." };
    expect(describeConnectError(new Error('IC0503: canister trapped'))).toEqual(fallback);
    expect(describeConnectError('boom')).toEqual(fallback);
    expect(describeConnectError(undefined)).toEqual(fallback);
  });
});
