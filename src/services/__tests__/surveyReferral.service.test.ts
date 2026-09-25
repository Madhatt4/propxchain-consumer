// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeMock, maybeSingleMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: maybeSingleMock }),
          }),
        }),
      }),
    }),
  },
}));

import {
  sendSurveyReferral,
  getSurveyReferralForTransaction,
  type SurveyReferralPayload,
} from '../surveyReferral.service';

const payload: SurveyReferralPayload = {
  transactionId: 'tx-test-1',
  customerFirstName: 'Test',
  customerLastName: 'TESTREFERRAL',
  customerEmail: 'buyer@example.com',
  customerPhone: '07700 900000',
  propertyAddressLine1: '1 Synthetic Street, Testville',
  propertyAddressPostcode: 'SG19 1AA',
  propertyValue: 350000,
};

describe('sendSurveyReferral', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('should invoke the optimus-survey-referral function with the payload', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, referralId: 'ref-1' }, error: null });

    const result = await sendSurveyReferral(payload);

    expect(invokeMock).toHaveBeenCalledWith('optimus-survey-referral', { body: payload });
    expect(result).toEqual({ success: true, referralId: 'ref-1' });
  });

  it('should return the invoke error message when the function call fails', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'network down' } });

    const result = await sendSurveyReferral(payload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('network down');
  });

  it('should surface a failure when the function responds without success', async () => {
    invokeMock.mockResolvedValue({ data: { success: false, error: 'rate_limited' }, error: null });

    const result = await sendSurveyReferral(payload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('rate_limited');
  });

  it('should report a generic error when the function returns no data', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });

    const result = await sendSurveyReferral(payload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Referral email could not be sent');
  });
});

describe('getSurveyReferralForTransaction', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
  });

  it('should map the latest referral row to a record', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'ref-1', provider_id: 'optimus', created_at: '2026-07-24T12:00:00Z', email_sent: true },
      error: null,
    });

    const record = await getSurveyReferralForTransaction('tx-test-1');

    expect(record).toEqual({
      id: 'ref-1',
      providerId: 'optimus',
      createdAt: '2026-07-24T12:00:00Z',
      emailSent: true,
    });
  });

  it('should return null when no referral exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect(await getSurveyReferralForTransaction('tx-none')).toBeNull();
  });

  it('should return null when the query errors', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'rls denied' } });

    expect(await getSurveyReferralForTransaction('tx-err')).toBeNull();
  });
});
