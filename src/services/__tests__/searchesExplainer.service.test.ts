import { describe, it, expect } from 'vitest';

import { buildCacheKey } from '@/services/searchesExplainer.service';

describe('buildCacheKey', () => {
  it('should produce the same key for the same area profile', () => {
    const a = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: ['coal-mining'],
      requiredSearchIds: ['local-authority-search', 'coal-mining-con29m'],
    });
    const b = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: ['coal-mining'],
      requiredSearchIds: ['local-authority-search', 'coal-mining-con29m'],
    });
    expect(a).toBe(b);
  });

  it('should ignore input ordering so equivalent profiles share a cache row', () => {
    const a = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: ['coal-mining', 'brine'],
      requiredSearchIds: ['b-search', 'a-search'],
    });
    const b = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: ['brine', 'coal-mining'],
      requiredSearchIds: ['a-search', 'b-search'],
    });
    expect(a).toBe(b);
  });

  it('should not mutate the arrays it is given', () => {
    const capabilities = ['coal-mining', 'brine'];
    const requiredSearchIds = ['b-search', 'a-search'];
    buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities,
      requiredSearchIds,
    });
    expect(capabilities).toEqual(['coal-mining', 'brine']);
    expect(requiredSearchIds).toEqual(['b-search', 'a-search']);
  });

  it('should differ when the transaction type differs', () => {
    const sale = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: [],
    });
    const purchase = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'purchase',
      capabilities: [],
      requiredSearchIds: [],
    });
    expect(sale).not.toBe(purchase);
  });

  it('should differ when the local authority differs', () => {
    const barnsley = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: [],
    });
    const bedford = buildCacheKey({
      localAuthorityName: 'Central Bedfordshire',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: [],
    });
    expect(barnsley).not.toBe(bedford);
  });

  it('should be case- and whitespace-insensitive on the local authority name', () => {
    const a = buildCacheKey({
      localAuthorityName: ' Barnsley ',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: [],
    });
    const b = buildCacheKey({
      localAuthorityName: 'barnsley',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: [],
    });
    expect(a).toBe(b);
  });

  it('should differ when the required search set differs', () => {
    const withCoal = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: ['local-authority-search', 'coal-mining-con29m'],
    });
    const withoutCoal = buildCacheKey({
      localAuthorityName: 'Barnsley',
      transactionType: 'sale',
      capabilities: [],
      requiredSearchIds: ['local-authority-search'],
    });
    expect(withCoal).not.toBe(withoutCoal);
  });
});
