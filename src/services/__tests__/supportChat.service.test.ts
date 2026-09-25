// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import {
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  MAX_PAGE_PATH_CHARS,
  SupportChatError,
  type ChatMessage,
  type ChatReply,
  chatErrorMessage,
  sendChatMessage,
  toWireMessages,
} from '../supportChat.service';

const REPLY: ChatReply = {
  reply: 'Your pack is on the Documents tab.',
  intent: 'product_help',
  confidence: 0.82,
  suggestTicket: false,
  sources: ['/resources/selling/what-is-a-property-pack'],
  model: 'deepseek/deepseek-v4-flash-0731',
};

/** The shape supabase-js hands back for a non-2xx from an edge function. */
function invokeFailure(status: number, body: Record<string, unknown>): { data: null; error: unknown } {
  return {
    data: null,
    error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: () => Promise.resolve(body) } },
  };
}

function lastBody(): { messages: ChatMessage[]; context: Record<string, unknown> } {
  const [, options] = mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1] as [
    string,
    { body: { messages: ChatMessage[]; context: Record<string, unknown> } },
  ];
  return options.body;
}

describe('supportChat.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: REPLY, error: null });
  });

  it('should post the conversation and the page path to support-chat', async () => {
    const reply = await sendChatMessage([{ role: 'user', text: 'Where is my pack?' }], { pagePath: '/dashboard' });

    expect(mockInvoke).toHaveBeenCalledWith('support-chat', {
      body: { messages: [{ role: 'user', text: 'Where is my pack?' }], context: { pagePath: '/dashboard' } },
    });
    expect(reply.reply).toBe(REPLY.reply);
    expect(reply.sources).toEqual(REPLY.sources);
  });

  it('should send transactionId and stage only when they are set', async () => {
    await sendChatMessage([{ role: 'user', text: 'How far along am I?' }], {
      pagePath: '/dashboard',
      transactionId: 'tx-9',
      stage: 'exchanged',
    });

    expect(lastBody().context).toEqual({ pagePath: '/dashboard', transactionId: 'tx-9', stage: 'exchanged' });

    await sendChatMessage([{ role: 'user', text: 'And now?' }], { pagePath: '/dashboard/settings' });

    expect(lastBody().context).toEqual({ pagePath: '/dashboard/settings' });
  });

  it('should never send a name, an email or a principal: the function reads the session', async () => {
    await sendChatMessage([{ role: 'user', text: 'hello' }], { pagePath: '/dashboard' });

    const body = lastBody() as unknown as Record<string, unknown>;
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('principal');
    expect(lastBody().context).not.toHaveProperty('email');
  });

  it('should keep only the most recent window of turns', () => {
    const many: ChatMessage[] = Array.from({ length: MAX_MESSAGES + 4 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `turn ${i}`,
    }));

    const wire = toWireMessages(many);

    expect(wire).toHaveLength(MAX_MESSAGES);
    expect(wire[wire.length - 1].text).toBe(`turn ${many.length - 1}`);
  });

  it('should trim an over-long assistant reply rather than let it 400 the next send', () => {
    const wire = toWireMessages([
      { role: 'assistant', text: 'x'.repeat(MAX_MESSAGE_CHARS + 500) },
      { role: 'user', text: 'and then?' },
    ]);

    expect(wire[0].text).toHaveLength(MAX_MESSAGE_CHARS);
    expect(wire[0].text.endsWith('…')).toBe(true);
    expect(wire[1].text).toBe('and then?');
  });

  it('should drop blank turns, which the function rejects outright', () => {
    expect(toWireMessages([{ role: 'user', text: '   ' }, { role: 'user', text: ' real ' }])).toEqual([
      { role: 'user', text: 'real' },
    ]);
  });

  it('should cap the page path at the length the function accepts', async () => {
    await sendChatMessage([{ role: 'user', text: 'hi' }], { pagePath: `/dashboard/${'a'.repeat(400)}` });

    expect((lastBody().context.pagePath as string).length).toBe(MAX_PAGE_PATH_CHARS);
  });

  it('should throw a SupportChatError carrying the function error code on a non-2xx', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(400, { error: 'invalid_request' }));

    await expect(sendChatMessage([{ role: 'user', text: 'hi' }], { pagePath: '/dashboard' })).rejects.toMatchObject({
      name: 'SupportChatError',
      status: 400,
      code: 'invalid_request',
    });
  });

  it('should carry resetIn through on a 429 so the UI can say how long to wait', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(429, { error: 'rate_limited', resetIn: 30 }));

    await expect(sendChatMessage([{ role: 'user', text: 'hi' }], { pagePath: '/dashboard' })).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      resetIn: 30,
    });
  });

  it('should fall back to the invoke message when the error body cannot be read', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network down', context: { status: 0, json: () => Promise.reject(new Error('no body')) } },
    });

    await expect(sendChatMessage([{ role: 'user', text: 'hi' }], { pagePath: '/dashboard' })).rejects.toMatchObject({
      code: 'network down',
    });
  });

  it('should throw rather than return undefined when the function answers 200 with no body', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(sendChatMessage([{ role: 'user', text: 'hi' }], { pagePath: '/dashboard' })).rejects.toBeInstanceOf(
      SupportChatError,
    );
  });

  it('should read every error back in the user\'s terms, blaming us for an unknown one', () => {
    expect(chatErrorMessage(new SupportChatError(429, 'rate_limited'))).toContain('Give it a moment');
    expect(chatErrorMessage(new SupportChatError(401, 'unauthorized'))).toContain('Sign in again');
    expect(chatErrorMessage(new SupportChatError(403, 'forbidden'))).toContain('Open a ticket');
    expect(chatErrorMessage(new SupportChatError(500, 'teapot'))).toContain('our end');
    expect(chatErrorMessage(new Error('plain'))).toContain('our end');
  });
});
