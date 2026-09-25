import { beforeEach, describe, expect, it } from 'vitest';

import { clearDealStorage, isDealStorageKey } from '../clearDealStorage';

describe('clearDealStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should remove every deal-data key and leave app preferences alone', () => {
    // Arrange
    const dealKeys = [
      'txflow:tx_1:p',
      'ta6_tx_1',
      'ta7_tx_1',
      'ta10_tx_1',
      'conveyancer_docs_tx_1',
      'conveyancer_txs_abc',
      'propx_kyc_abc',
      'tx_postcode_tx_1',
      'transactionTier_tx_1',
      'doc_id_mapping_d1',
      'web2_documents',
      'propxchain_property_searches',
      'propxchain_search_signoffs',
      'propxchain_acknowledged_docs',
      'txPartyCount',
    ];
    const keptKeys = ['px-theme', 'estate-agent.listings.view', 'settings'];
    for (const k of [...dealKeys, ...keptKeys]) localStorage.setItem(k, 'x');

    // Act
    clearDealStorage();

    // Assert
    for (const k of dealKeys) expect(localStorage.getItem(k)).toBeNull();
    for (const k of keptKeys) expect(localStorage.getItem(k)).toBe('x');
  });

  it('should do nothing on empty storage', () => {
    expect(() => clearDealStorage()).not.toThrow();
    expect(localStorage.length).toBe(0);
  });

  it('should not treat a key that merely contains a prefix as deal data', () => {
    expect(isDealStorageKey('my_ta6_notes')).toBe(false);
    expect(isDealStorageKey('ta6_tx_9')).toBe(true);
  });
});
