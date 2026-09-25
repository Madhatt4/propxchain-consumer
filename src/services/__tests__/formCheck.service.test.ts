// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for formCheck.service.ts — mocks the Supabase client, same pattern as
 * conveyancerBrief.service.test.ts. Nothing here reaches a real function.
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

import { FormCheckError, checkForm, type FormCheckResult } from '../formCheck.service';

const RESULT: FormCheckResult = {
  form: 'ta6',
  readyToSubmit: 0.08,
  followUpScore: 2.4,
  worstSection: 'section5_alterations',
  flags: [
    { key: 'missing_consents', label: 'Alterations look unevidenced.', probability: 0.86, section: 'section5_alterations', severity: 'block' },
  ],
  deterministic: [
    { key: 'detail_missing_5.8', label: 'Question 5.8 is answered Yes with no detail.', section: 'section5' },
  ],
  model: 'typesafe-system-one',
  checkedAt: '2026-09-19T10:00:00.000Z',
};

/** The shape supabase-js hands back for a non-2xx from an edge function. */
function invokeError(status: number, body: Record<string, unknown>): { data: null; error: unknown } {
  return {
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { status, json: async () => body },
    },
  };
}

describe('formCheck.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('checkForm', () => {
    it('should post the transaction id and form and return the result', async () => {
      mockInvoke.mockResolvedValue({ data: RESULT, error: null });

      const result = await checkForm('tx_test', 'ta6');

      expect(result).toEqual(RESULT);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const [fnName, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
      expect(fnName).toBe('form-check');
      expect(opts.body).toEqual({ transactionId: 'tx_test', form: 'ta6' });
    });

    it('should send no answers and no personal data, only the two identifiers', async () => {
      mockInvoke.mockResolvedValue({ data: { ...RESULT, form: 'ta10' }, error: null });

      await checkForm('tx_test', 'ta10');

      const [, opts] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
      expect(Object.keys(opts.body).sort()).toEqual(['form', 'transactionId']);
    });

    it('should throw a FormCheckError with status 403 when the caller is not on the seller side', async () => {
      mockInvoke.mockResolvedValue(invokeError(403, { error: 'forbidden' }));

      await expect(checkForm('tx_test', 'ta6')).rejects.toMatchObject({
        name: 'FormCheckError',
        status: 403,
        code: 'forbidden',
      });
    });

    it('should throw status 404 with code form_not_found when nothing is saved to check', async () => {
      mockInvoke.mockResolvedValue(invokeError(404, { error: 'form_not_found' }));

      await expect(checkForm('tx_test', 'ta10')).rejects.toMatchObject({ status: 404, code: 'form_not_found' });
    });

    it('should carry resetIn through on a 429 so the UI can say how long to wait', async () => {
      mockInvoke.mockResolvedValue(invokeError(429, { error: 'rate_limited', resetIn: 42 }));

      await expect(checkForm('tx_test', 'ta6')).rejects.toMatchObject({
        status: 429,
        code: 'rate_limited',
        resetIn: 42,
      });
    });

    it('should fall back to the transport message when the body is not the JSON the contract promises', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 500, json: async () => { throw new SyntaxError('not json'); } },
        },
      });

      await expect(checkForm('tx_test', 'ta6')).rejects.toMatchObject({
        status: 500,
        code: 'Edge Function returned a non-2xx status code',
      });
    });

    it('should report status 0 on a transport failure with no response at all', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

      await expect(checkForm('tx_test', 'ta6')).rejects.toMatchObject({ status: 0, code: 'Failed to fetch' });
    });

    it('should throw rather than return null when the function answers 200 with no body', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: null });

      await expect(checkForm('tx_test', 'ta6')).rejects.toBeInstanceOf(FormCheckError);
    });
  });
});
