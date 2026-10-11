import { beforeEach, describe, expect, it } from 'vitest';

import { clearDealStorage, isDealStorageKey, LAST_PRINCIPAL_KEY, rememberSignedInPrincipal } from '../clearDealStorage';

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
      'rightmoveListings',
      'propertyTitleNumbers',
    ];
    const keptKeys = ['px-theme', 'estate-agent.listings.view', 'settings', LAST_PRINCIPAL_KEY];
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

describe('rememberSignedInPrincipal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should keep deal data on the first sign-in on this browser and remember who it was', () => {
    localStorage.setItem('rightmoveListings', '{"tx_1":{}}');

    expect(rememberSignedInPrincipal('aaaaa-aa')).toBe(false);

    expect(localStorage.getItem('rightmoveListings')).toBe('{"tx_1":{}}');
    expect(localStorage.getItem(LAST_PRINCIPAL_KEY)).toBe('aaaaa-aa');
  });

  it('should keep deal data when the same principal signs in again', () => {
    rememberSignedInPrincipal('aaaaa-aa');
    localStorage.setItem('txflow:tx_1:aaaaa-aa', 'x');

    expect(rememberSignedInPrincipal('aaaaa-aa')).toBe(false);

    expect(localStorage.getItem('txflow:tx_1:aaaaa-aa')).toBe('x');
  });

  it('should wipe the previous account\'s deal data when a different principal signs in', () => {
    rememberSignedInPrincipal('aaaaa-aa');
    localStorage.setItem('rightmoveListings', '{"tx_1":{}}');
    localStorage.setItem('txflow:tx_1:aaaaa-aa', 'x');
    localStorage.setItem('px-theme', 'dark');

    expect(rememberSignedInPrincipal('bbbbb-bb')).toBe(true);

    expect(localStorage.getItem('rightmoveListings')).toBeNull();
    expect(localStorage.getItem('txflow:tx_1:aaaaa-aa')).toBeNull();
    expect(localStorage.getItem('px-theme')).toBe('dark');
    expect(localStorage.getItem(LAST_PRINCIPAL_KEY)).toBe('bbbbb-bb');
  });

  it('should treat unreadable storage as a first sign-in rather than throw', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => undefined,
      key: () => null,
      length: 0,
      clear: () => undefined,
    } as unknown as Storage;

    expect(rememberSignedInPrincipal('aaaaa-aa', broken)).toBe(false);
  });
});
