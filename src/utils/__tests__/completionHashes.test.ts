import { describe, it, expect } from 'vitest';
import { buildCompletionHashes, completionHashInputOf } from '../completionHashes';

describe('completionHashInputOf', () => {
  it('should return the trimmed input when price and address are real', () => {
    expect(completionHashInputOf('tx-1', ' 1 Test Street ', 250000))
      .toEqual({ transactionId: 'tx-1', propertyAddress: '1 Test Street', purchasePrice: 250000 });
  });

  it.each([
    ['no price', 'tx-1', '1 Test Street', undefined],
    ['a zero price', 'tx-1', '1 Test Street', 0],
    ['a non-finite price', 'tx-1', '1 Test Street', Number.NaN],
    ['a blank address', 'tx-1', '   ', 250000],
    ['the Unknown property placeholder', 'tx-1', 'Unknown property', 250000],
    ['no address', 'tx-1', undefined, 250000],
    ['no transaction', undefined, '1 Test Street', 250000],
  ])('should return null for %s', (_label, txId, address, price) => {
    expect(completionHashInputOf(txId, address, price)).toBeNull();
  });
});

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
