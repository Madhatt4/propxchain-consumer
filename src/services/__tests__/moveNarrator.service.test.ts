import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  fireNarration,
  getNarrationStatus,
  deliverNarration,
  isNarrationSettled,
  type MoveNarratorTransaction,
} from '../moveNarrator.service';
import type { NextStepRecommendation } from '../next-step.service';

const mockInvoke = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const TX: MoveNarratorTransaction = {
  txId: 'tx_test',
  url: 'https://app.example/transaction/tx_test',
  role: 'seller',
  propertyAddress: '14 Example Road, Sandy SG19 1AB',
  previousBlocker: 'no_solicitor',
};

const NEXT_STEP: NextStepRecommendation = {
  blocker: 'hmlr_not_fetched',
  blockerLabel: 'Title not yet pulled',
  options: [],
  urgency: 'soon',
  why: 'The HMLR title has not been fetched yet.',
  partial: false,
};

describe('moveNarrator.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('should post a fire action with the transaction and getNextStep verbatim', async () => {
    mockInvoke.mockResolvedValue({ data: { sessionId: 'sess_1' }, error: null });

    const sessionId = await fireNarration(TX, NEXT_STEP);

    expect(sessionId).toBe('sess_1');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fnName, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
    expect(fnName).toBe('move-narrator');
    expect(opts.body).toEqual({
      action: 'fire',
      transaction: TX,
      getNextStep: NEXT_STEP,
    });
  });

  it('should poll status and return the run status + verdict', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'idle', verdict: 'satisfied' },
      error: null,
    });

    const result = await getNarrationStatus('sess_1');

    expect(result).toEqual({ status: 'idle', verdict: 'satisfied' });
    const [, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
    expect(opts.body).toEqual({ action: 'status', sessionId: 'sess_1' });
  });

  it('should include txId in the status body when provided (telemetry-only)', async () => {
    mockInvoke.mockResolvedValue({ data: { status: 'idle', verdict: 'satisfied' }, error: null });

    await getNarrationStatus('sess_1', 'tx_test');

    const [, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
    expect(opts.body).toEqual({ action: 'status', sessionId: 'sess_1', txId: 'tx_test' });
  });

  it('should deliver and return the in-app notification + channel results', async () => {
    const notification = {
      title: 'Your title is on its way',
      body: 'We requested the official title from HM Land Registry.',
      txUrl: TX.url,
      urgency: 'soon',
    };
    mockInvoke.mockResolvedValue({
      data: { notification, results: [{ channel: 'in_app', status: 'returned_to_client' }] },
      error: null,
    });

    const result = await deliverNarration('sess_1');

    expect(result.notification).toEqual(notification);
    expect(result.results).toHaveLength(1);
    const [, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
    // Security regression guard (audit 2026-07-25, finding #2): the delivery
    // address must never be client-supplied. The edge function derives it from
    // the authenticated session; if a `recipient` key ever reappears here, the
    // open-relay hole is back.
    expect(opts.body).toEqual({
      action: 'deliver',
      sessionId: 'sess_1',
    });
    expect(opts.body).not.toHaveProperty('recipient');
  });

  it('should include txId in the deliver body when provided (telemetry-only)', async () => {
    mockInvoke.mockResolvedValue({
      data: { notification: null, results: [] },
      error: null,
    });

    await deliverNarration('sess_1', 'tx_test');

    const [, opts] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
    expect(opts.body).toEqual({ action: 'deliver', sessionId: 'sess_1', txId: 'tx_test' });
    expect(opts.body).not.toHaveProperty('recipient');
  });

  it('should throw when the edge function returns a transport error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(fireNarration(TX, NEXT_STEP)).rejects.toThrow(/boom/);
  });

  it('should throw when the edge function returns an application error body', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'server not configured' }, error: null });

    await expect(getNarrationStatus('sess_1')).rejects.toThrow(/server not configured/);
  });
});

describe('isNarrationSettled', () => {
  it('should not settle on the transient idle a just-fired session reports before its run starts', () => {
    // The run starts asynchronously after `fire`: for a few seconds the
    // session is `idle` with verdict `pending`. Delivering then finds no files.
    expect(isNarrationSettled('idle', 'pending')).toBe(false);
  });

  it('should not settle while the run is in progress', () => {
    expect(isNarrationSettled('running', 'pending')).toBe(false);
  });

  it('should not settle when idle but no evaluation has been recorded', () => {
    expect(isNarrationSettled('idle', null)).toBe(false);
  });

  it('should settle when idle with a satisfied verdict', () => {
    expect(isNarrationSettled('idle', 'satisfied')).toBe(true);
  });

  it('should settle when idle with an unsatisfied verdict so partial outputs can still deliver', () => {
    expect(isNarrationSettled('idle', 'unsatisfied')).toBe(true);
  });
});
