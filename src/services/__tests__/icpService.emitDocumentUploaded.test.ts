import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { icpService } from '../icp.service';

describe('icpService.emitDocumentUploadedEvent', () => {
  const logEvent = vi.fn();

  type Internals = { ledgerManagerActor: { logEvent: typeof logEvent } | null };

  beforeEach(() => {
    logEvent.mockReset().mockResolvedValue({ ok: BigInt(1) });
    (icpService as unknown as Internals).ledgerManagerActor = { logEvent };
  });

  afterEach(() => {
    (icpService as unknown as Internals).ledgerManagerActor = null;
  });

  // The ledger is permanent, so the event carries the type and hash only —
  // a user's filename can hold their name or account number.
  it('should log document_uploaded with type and hash, and no filename', async () => {
    icpService.emitDocumentUploadedEvent('tx-001', 'ta6_form', 'abc123');
    await Promise.resolve();

    expect(logEvent).toHaveBeenCalledTimes(1);
    const [txId, eventType, details, metadata] = logEvent.mock.calls[0];
    expect(txId).toBe('tx-001');
    expect(eventType).toBe('document_uploaded');
    expect(details).toBe('Document (ta6_form) registered on chain');
    expect(metadata).toHaveLength(1);
    const parsed = JSON.parse(metadata[0]);
    expect(parsed).toEqual({ documentType: 'ta6_form', fileHash: 'abc123' });
  });

  it('is a no-op when transactionId is undefined (property-level upload)', async () => {
    icpService.emitDocumentUploadedEvent(undefined, 't', 'h');
    await Promise.resolve();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('is a no-op when transactionId is empty string', async () => {
    icpService.emitDocumentUploadedEvent('', 't', 'h');
    await Promise.resolve();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does not throw when logEvent rejects (fire-and-forget)', async () => {
    logEvent.mockRejectedValueOnce(new Error('ledger unreachable'));
    expect(() =>
      icpService.emitDocumentUploadedEvent('tx-001', 't', 'h'),
    ).not.toThrow();
    await Promise.resolve();
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it('is synchronous — returns void, never a promise', () => {
    const result = icpService.emitDocumentUploadedEvent('tx-001', 't', 'h');
    expect(result).toBeUndefined();
  });
});
