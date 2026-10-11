import { describe, it, expect } from 'vitest';
import { buildLedgerDocuments, type LedgerTransactionInput } from '../ledgerDocuments';

const REAL_HASH = 'a3f1c9e2b7d4' + '0'.repeat(52);

function tx(overrides: Partial<LedgerTransactionInput> = {}): LedgerTransactionInput {
  return {
    transactionId: 'tx_42',
    propertyAddress: '1 Test Street',
    onChain: [],
    local: [],
    ...overrides,
  };
}

describe('buildLedgerDocuments', () => {
  it('should show the canister hash and Verified when document_storage says verified', () => {
    // Arrange
    const input = tx({
      onChain: [{ id: 'doc_7', hash: REAL_HASH, verified: true, name: 'Title Deeds', type: 'titleDeeds' }],
    });

    // Act
    const [doc] = buildLedgerDocuments(input);

    // Assert
    expect(doc.blockchainHash).toBe(REAL_HASH);
    expect(doc.chainStatus).toBe('verified');
  });

  it('should mark an on-chain document unverified when the canister verified flag is false', () => {
    // Arrange
    const input = tx({ onChain: [{ id: 'doc_8', hash: REAL_HASH, verified: false }] });

    // Act
    const [doc] = buildLedgerDocuments(input);

    // Assert
    expect(doc.blockchainHash).toBe(REAL_HASH);
    expect(doc.chainStatus).toBe('recorded');
  });

  it('should never call a chain row verified when the canister holds no hash for it', () => {
    // Arrange
    const input = tx({ onChain: [{ id: 'doc_9', hash: '  ', verified: true }] });

    // Act
    const [doc] = buildLedgerDocuments(input);

    // Assert
    expect(doc.blockchainHash).toBeNull();
    expect(doc.chainStatus).toBe('not-on-chain');
  });

  it('should show a local-only document as not recorded on chain with no hash', () => {
    // Arrange
    const input = tx({ local: [{ name: 'EPC.pdf', type: 'application/pdf', size: 2048 }] });

    // Act
    const [doc] = buildLedgerDocuments(input);

    // Assert
    expect(doc.blockchainHash).toBeNull();
    expect(doc.chainStatus).toBe('not-on-chain');
    expect(doc.uploadedAt).toBeNull();
  });

  it('should not show a localStorage hash that the canister does not hold', () => {
    // Arrange
    const input = tx({ local: [{ name: 'Survey.pdf', blockchainHash: 'hash_1700000000000_0' }] });

    // Act
    const [doc] = buildLedgerDocuments(input);

    // Assert
    expect(doc.blockchainHash).toBeNull();
    expect(doc.chainStatus).toBe('not-on-chain');
  });

  it('should say the chain could not be checked when the lookup failed', () => {
    // Arrange
    const input = tx({ onChain: null, local: [{ name: 'TA6.pdf' }] });

    // Act
    const [doc] = buildLedgerDocuments(input);

    // Assert
    expect(doc.blockchainHash).toBeNull();
    expect(doc.chainStatus).toBe('unchecked');
  });

  it('should list a document once when the local copy carries the same hash as the chain row', () => {
    // Arrange
    const input = tx({
      onChain: [{ id: 'doc_1', hash: REAL_HASH, verified: false }],
      local: [{ name: 'Deeds.pdf', blockchainHash: REAL_HASH.toUpperCase() }],
    });

    // Act
    const docs = buildLedgerDocuments(input);

    // Assert
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('chain_tx_42_doc_1');
  });

  it('should return no rows for a transaction with no documents anywhere', () => {
    // Arrange / Act
    const docs = buildLedgerDocuments(tx());

    // Assert
    expect(docs).toEqual([]);
  });
});
