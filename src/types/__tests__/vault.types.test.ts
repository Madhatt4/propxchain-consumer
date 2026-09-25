import { describe, it, expect } from 'vitest';
import {
  VAULT_SLOTS,
  VAULT_SLOT_IDS,
  vaultDocumentSchema,
  walletObjectPath,
} from '../vault.types';

const validDoc = {
  id: 'row-1',
  slotId: 'proofOfId',
  blockchainId: 12,
  fileHash: 'a'.repeat(64),
  fileSize: 2048,
  mimeType: 'application/pdf',
  uploadedAt: '2026-08-18T10:00:00.000Z',
  objectPath: 'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
};

describe('vault.types', () => {
  it('should define the seven wallet slots in order (5 pinned + 2 custom)', () => {
    expect(VAULT_SLOTS.map((s) => s.id)).toEqual([
      'amlSourceOfFunds',
      'proofOfId',
      'decisionInPrinciple',
      'mortgageOffer',
      'proofOfOwnership',
      'custom1',
      'custom2',
    ]);
    expect(VAULT_SLOT_IDS).toHaveLength(7);
  });

  it('should give Proof of Ownership a matching generic on-chain label', () => {
    const slot = VAULT_SLOTS.find((s) => s.id === 'proofOfOwnership');
    expect(slot?.label).toBe('Proof of Ownership');
    expect(slot?.onChainLabel).toBe('Proof of Ownership');
    expect(slot?.custom).toBeUndefined();
  });

  it('should mark only the two custom slots as custom', () => {
    const custom = VAULT_SLOTS.filter((s) => s.custom).map((s) => s.id);
    expect(custom).toEqual(['custom1', 'custom2']);
  });

  it('should give pinned slots a matching on-chain label and custom slots a generic one', () => {
    for (const slot of VAULT_SLOTS) {
      if (slot.custom) {
        // never the display label — a custom name must not be anchorable (ADR 0003)
        expect(slot.onChainLabel).toBe('Custom document');
      } else {
        expect(slot.onChainLabel).toBe(slot.label);
      }
    }
  });

  it('should mark the DIP and mortgage-offer slots with a buyers note', () => {
    const withNote = VAULT_SLOTS.filter((s) => s.buyersOnlyNote).map((s) => s.id);
    expect(withNote).toEqual(['decisionInPrinciple', 'mortgageOffer']);
  });

  it('should build the wallet object path with the owner uid as the 2nd segment', () => {
    const p = walletObjectPath('uid-1', 'proofOfId', 'abcdef123456' + 'f'.repeat(52), 'application/pdf');
    expect(p).toBe('wallet/uid-1/proofOfId-abcdef123456.pdf');
    expect(p.split('/')[1]).toBe('uid-1');
  });

  it('should accept a well-formed wallet document without a filename', () => {
    const result = vaultDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty('fileName');
  });

  it('should reject a document whose hash is not 64 hex chars', () => {
    expect(vaultDocumentSchema.safeParse({ ...validDoc, fileHash: 'not-a-hash' }).success).toBe(false);
  });

  it('should accept an optional label and reject one over 60 chars', () => {
    expect(vaultDocumentSchema.safeParse({ ...validDoc, label: 'Barclays statement March' }).success).toBe(true);
    expect(vaultDocumentSchema.safeParse({ ...validDoc, label: 'x'.repeat(61) }).success).toBe(false);
  });

  it('should reject a document record without an object path', () => {
    const { objectPath: _omit, ...noPath } = validDoc;
    expect(vaultDocumentSchema.safeParse(noPath).success).toBe(false);
  });
});
