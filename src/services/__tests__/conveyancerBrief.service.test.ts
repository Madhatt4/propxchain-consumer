// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for conveyancerBrief.service.ts — mocks the Supabase client, same
 * pattern as moveNarrator.service.test.ts / partyInvite.service.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import {
  composeConveyancerBrief,
  getConveyancerBriefDraft,
  sendConveyancerBrief,
  isNoWorkArising,
  ConveyancerBriefError,
  type ConveyancerBriefDraft,
} from '../conveyancerBrief.service';

const DRAFT: ConveyancerBriefDraft = {
  briefId: 'brief-1',
  subject: '14 Example Road — work arising',
  bodyMd: '## Tasks\n\nRegistered charge 1 of 1 — redemption.',
  itemCount: 1,
  notAvailable: ['Survey scan not yet available'],
  status: 'draft',
};

describe('conveyancerBrief.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('composeConveyancerBrief', () => {
    it('should post a compose action with the transactionId and return the draft', async () => {
      mockInvoke.mockResolvedValue({ data: DRAFT, error: null });

      const result = await composeConveyancerBrief('tx_test');

      expect(result).toEqual(DRAFT);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const [fnName, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
      expect(fnName).toBe('conveyancer-brief');
      expect(opts.body).toEqual({ action: 'compose', transactionId: 'tx_test' });
    });

    it('should return { briefId: null, reason } when the scans produced no work items', async () => {
      mockInvoke.mockResolvedValue({ data: { briefId: null, reason: 'no_work_arising' }, error: null });

      const result = await composeConveyancerBrief('tx_test');

      expect(result).toEqual({ briefId: null, reason: 'no_work_arising' });
      expect(isNoWorkArising(result)).toBe(true);
    });

    it('should throw a ConveyancerBriefError with status 403 when there is no accepted quote', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 403, json: async () => ({ error: 'forbidden' }) },
        },
      });

      await expect(composeConveyancerBrief('tx_test')).rejects.toBeInstanceOf(ConveyancerBriefError);
      await expect(composeConveyancerBrief('tx_test')).rejects.toMatchObject({
        status: 403,
        code: 'forbidden',
      });
    });

    it('should surface the rate-limit resetIn on a 429', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 429, json: async () => ({ error: 'rate_limited', resetIn: 120 }) },
        },
      });

      await expect(composeConveyancerBrief('tx_test')).rejects.toMatchObject({
        status: 429,
        code: 'rate_limited',
        resetIn: 120,
      });
    });

    it('should surface a 502 compose_failed as a ConveyancerBriefError, not a generic throw', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 502, json: async () => ({ error: 'compose_failed', detail: 'boom' }) },
        },
      });

      await expect(composeConveyancerBrief('tx_test')).rejects.toMatchObject({
        status: 502,
        code: 'compose_failed',
      });
    });
  });

  describe('getConveyancerBriefDraft', () => {
    it('should post a get action and return the current draft', async () => {
      mockInvoke.mockResolvedValue({ data: DRAFT, error: null });

      const result = await getConveyancerBriefDraft('tx_test');

      expect(result).toEqual(DRAFT);
      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
      expect(opts.body).toEqual({ action: 'get', transactionId: 'tx_test' });
    });

    it('should return null when there is no current draft', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: null });

      const result = await getConveyancerBriefDraft('tx_test');

      expect(result).toBeNull();
    });

    it('should return a draft whose status is sending without hiding it as absent', async () => {
      mockInvoke.mockResolvedValue({ data: { ...DRAFT, status: 'sending' }, error: null });

      const result = await getConveyancerBriefDraft('tx_test');

      expect(result?.status).toBe('sending');
    });

    it('should throw 403 forbidden when the caller has no accepted quote', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 403, json: async () => ({ error: 'forbidden' }) },
        },
      });

      await expect(getConveyancerBriefDraft('tx_test')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    });
  });

  describe('sendConveyancerBrief', () => {
    it('should post a send action with the briefId and return the result', async () => {
      mockInvoke.mockResolvedValue({ data: { sent: true, conveyancerId: 'conv-1' }, error: null });

      const result = await sendConveyancerBrief('brief-1');

      expect(result).toEqual({ sent: true, conveyancerId: 'conv-1' });
      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
      expect(opts.body).toEqual({ action: 'send', briefId: 'brief-1' });
    });

    it('should throw 404 not_found for an unknown brief', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 404, json: async () => ({ error: 'not_found' }) },
        },
      });

      await expect(sendConveyancerBrief('missing')).rejects.toMatchObject({ status: 404, code: 'not_found' });
    });

    it.each(['already_sent', 'already_sending', 'conflict'])(
      'should throw 409 %s so the UI can treat it as "cannot send right now"',
      async (code) => {
        mockInvoke.mockResolvedValue({
          data: null,
          error: {
            message: 'Edge Function returned a non-2xx status code',
            context: { status: 409, json: async () => ({ error: code }) },
          },
        });

        await expect(sendConveyancerBrief('brief-1')).rejects.toMatchObject({ status: 409, code });
      },
    );

    it('should throw 502 send_failed — the draft is still there, retry is safe', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 502, json: async () => ({ error: 'send_failed' }) },
        },
      });

      await expect(sendConveyancerBrief('brief-1')).rejects.toMatchObject({ status: 502, code: 'send_failed' });
    });

    it('should throw 502 conveyancer_email_unavailable distinctly from send_failed', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 502, json: async () => ({ error: 'conveyancer_email_unavailable' }) },
        },
      });

      await expect(sendConveyancerBrief('brief-1')).rejects.toMatchObject({
        status: 502,
        code: 'conveyancer_email_unavailable',
      });
    });

    it('should throw 403 forbidden when the side mismatches or the quote is no longer accepted', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 403, json: async () => ({ error: 'forbidden' }) },
        },
      });

      await expect(sendConveyancerBrief('brief-1')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    });
  });

  describe('error fallback behaviour', () => {
    it('should fall back to the transport message when the error body cannot be parsed', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 500,
            json: async () => {
              throw new Error('not json');
            },
          },
        },
      });

      await expect(composeConveyancerBrief('tx_test')).rejects.toMatchObject({
        status: 500,
        code: 'Edge Function returned a non-2xx status code',
      });
    });

    it('should fall back to status 0 when the error has no context (pure network failure)', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'network down' } });

      await expect(composeConveyancerBrief('tx_test')).rejects.toMatchObject({ status: 0, code: 'network down' });
    });
  });
});

describe('isNoWorkArising', () => {
  it('should be false for a real draft', () => {
    expect(isNoWorkArising(DRAFT)).toBe(false);
  });

  it('should be true for the no-work-arising result', () => {
    expect(isNoWorkArising({ briefId: null, reason: 'no_work_arising' })).toBe(true);
  });
});
