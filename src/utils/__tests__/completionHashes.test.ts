import { describe, it, expect } from 'vitest';
import { buildCompletionHashes } from '../completionHashes';

async function sha256Hex(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('buildCompletionHashes', () => {
  it('should hash the same funds and statement shapes the exchange page has always written', async () => {
    const now = new Date('2026-11-06T12:00:00.000Z');
    const input = { transactionId: 'tx-1', propertyAddress: '1 Test Street', purchasePrice: 250000 };

    const hashes = await buildCompletionHashes(input, now);

    expect(hashes.fundsHash).toBe(
      await sha256Hex({ transactionId: 'tx-1', amount: 250000, timestamp: now.toISOString() }),
    );
    expect(hashes.completionHash).toBe(
      await sha256Hex({ transactionId: 'tx-1', propertyAddress: '1 Test Street', completionDate: now.toISOString(), purchasePrice: 250000 }),
    );
  });
});
