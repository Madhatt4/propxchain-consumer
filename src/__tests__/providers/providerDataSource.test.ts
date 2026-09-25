import { describe, it, expect } from 'vitest';
import { StaticProviderDataSource } from '../../services/providerDataSource';

describe('StaticProviderDataSource', () => {
  const dataSource = new StaticProviderDataSource();

  describe('getProviders', () => {
    it('should return 4 AML providers for aml_kyc category', async () => {
      const providers = await dataSource.getProviders('aml_kyc');
      expect(providers).toHaveLength(4);
      providers.forEach((p) => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
      });
      // Verify365 never quoted a figure — the row must carry no price at all.
      expect(providers.find((p) => p.id === 'verify365')?.price).toBeUndefined();
    });

    it('should return 4 search providers for searches category', async () => {
      const providers = await dataSource.getProviders('searches');
      expect(providers).toHaveLength(4);
    });

    it('should return 4 conveyancer providers for conveyancer category', async () => {
      const providers = await dataSource.getProviders('conveyancer');
      expect(providers).toHaveLength(4);
    });

    // Optimus is the only live survey referral partner (the placeholder
    // surveyors were removed 2026-07-24). Asserted by id rather than by
    // count so that reopening the panel fails this test loudly and someone
    // has to confirm every listed surveyor is a real, live partner.
    it('should return only Optimus for survey category while it is the sole referral partner', async () => {
      const providers = await dataSource.getProviders('survey');
      expect(providers.map((p) => p.id)).toEqual(['optimus']);
    });

    it('should return providers sorted ascending by price when sortBy is price', async () => {
      const providers = await dataSource.getProviders('aml_kyc', { sortBy: 'price' });
      const priced = providers.map((p) => p.price).filter((p): p is number => p !== undefined);
      for (let i = 1; i < priced.length; i++) {
        expect(priced[i]).toBeGreaterThanOrEqual(priced[i - 1]);
      }
      // Every unpriced provider (no partner quote) sorts after every priced one —
      // checking only the last element would pass with an unpriced item in the middle.
      const firstUnpriced = providers.findIndex((p) => p.price === undefined);
      if (firstUnpriced !== -1) {
        expect(providers.slice(firstUnpriced).every((p) => p.price === undefined)).toBe(true);
      }
    });

    it('should return providers sorted descending by rating when sortBy is rating', async () => {
      const providers = await dataSource.getProviders('aml_kyc', { sortBy: 'rating' });
      for (let i = 1; i < providers.length; i++) {
        expect(providers[i].rating).toBeLessThanOrEqual(providers[i - 1].rating);
      }
    });
  });

  describe('getProvider', () => {
    it('should return the provider when given a valid ID', async () => {
      const allProviders = await dataSource.getProviders('aml_kyc');
      const firstId = allProviders[0].id;

      const provider = await dataSource.getProvider(firstId);
      expect(provider).not.toBeNull();
      expect(provider!.id).toBe(firstId);
      expect(provider!.name).toBe(allProviders[0].name);
    });

    it('should return null when given an invalid ID', async () => {
      const provider = await dataSource.getProvider('nonexistent-provider-id');
      expect(provider).toBeNull();
    });
  });
});
