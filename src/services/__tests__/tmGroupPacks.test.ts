import { describe, expect, it } from 'vitest';

import { tmGroupProvider } from '../searchProviderData';
import {
  missingTmGroupCodes,
  resolveTmGroupPack,
  resolveTmGroupPacks,
  tmGroupPacks,
} from '../tmGroupPacks';

const catalogueCodes = new Set(
  [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches]
    .map((item) => item.productType)
    .filter((code): code is string => Boolean(code)),
);

describe('tmGroupPacks', () => {
  it('should carry all six packs tmGroup quoted on 2026-08-26', () => {
    expect(tmGroupPacks).toHaveLength(6);
    expect(tmGroupPacks.filter((pack) => pack.family === 'regulated')).toHaveLength(3);
    expect(tmGroupPacks.filter((pack) => pack.family === 'official')).toHaveLength(3);
  });

  it('should mark every official pack as excluding the authority fees', () => {
    // Official pack prices exclude the council and water charges. A pack
    // presented as complete when it is not reads as cheaper than it really is.
    tmGroupPacks
      .filter((pack) => pack.family === 'official')
      .forEach((pack) => expect(pack.excludesAuthorityFees).toBe(true));
  });

  it('should mark every regulated pack as fixed price', () => {
    tmGroupPacks
      .filter((pack) => pack.family === 'regulated')
      .forEach((pack) => expect(pack.excludesAuthorityFees).toBe(false));
  });
});

describe('resolveTmGroupPack', () => {
  it('should resolve the official Homebuyers pack onto orderable catalogue codes', () => {
    const pack = tmGroupPacks.find((entry) => entry.id === 'tmg-official-homebuyers');
    expect(pack).toBeDefined();

    const resolved = resolveTmGroupPack(pack!);

    expect(resolved.isAvailable).toBe(true);
    expect(resolved.missingCodes).toEqual([]);
    // LLC1 and Con29 are aliases for the codes the API accepts.
    expect(resolved.orderCodes).toEqual(['TMGLLC1', 'TMGCon29', 'Con29DW', 'GSEnviro']);
    expect(resolved.itemIds).toHaveLength(4);
  });

  it('should return every order code from the verified catalogue', () => {
    resolveTmGroupPacks()
      .filter((pack) => pack.isAvailable)
      .forEach((pack) => {
        pack.orderCodes.forEach((code) => expect(catalogueCodes.has(code)).toBe(true));
      });
  });

  it('should fail closed when a quoted code has no catalogue entry', () => {
    // Every real pack resolves since 2026-09-01, so this uses a synthetic pack.
    // The property is the point and must outlive the blocker that motivated it:
    // a pack we cannot fulfil IN FULL must never resolve to the subset that
    // happens to exist, or the customer buys fewer searches than the pack names.
    const resolved = resolveTmGroupPack({
      id: 'test-unfulfillable',
      name: 'Test',
      family: 'regulated',
      tagline: 'Synthetic pack with one code tmGroup has never returned.',
      quotedCodes: ['PSReport12', 'NOT_A_REAL_CODE', 'GSEnviro'],
      excludesAuthorityFees: false,
    });

    expect(resolved.isAvailable).toBe(false);
    expect(resolved.missingCodes).toEqual(['NOT_A_REAL_CODE']);
    expect(resolved.itemIds).toEqual([]);
    expect(resolved.orderCodes).toEqual([]);
  });

  it('should resolve all three official packs now GSAvistaR and FTResCR are curated in', () => {
    // Both were in tmGroup's 98-product response all along (lines 214 and 208).
    // They were missing from OUR list, which is a different problem, and was
    // wrongly reported to tmGroup as theirs.
    const official = resolveTmGroupPacks().filter((pack) => pack.family === 'official');

    expect(official).toHaveLength(3);
    official.forEach((pack) => {
      expect(pack.isAvailable).toBe(true);
      expect(pack.missingCodes).toEqual([]);
    });
    expect(
      official.find((p) => p.id === 'tmg-official-avista-chancel')?.orderCodes,
    ).toEqual(['TMGLLC1', 'TMGCon29', 'Con29DW', 'GSAvistaR', 'FTResCR']);
  });

  it('should resolve all three regulated packs now CDSRegWDR is activated', () => {
    // Blocked from 2026-08-26 to 2026-09-01. CDSRegWDR was never missing from
    // tmGroup's catalogue — it was not activated on our DEMO20 account, and a
    // re-pull after tmGroup had ops enable the pack codes returned 100
    // products where the first read returned 98.
    const regulated = resolveTmGroupPacks().filter((pack) => pack.family === 'regulated');

    expect(regulated).toHaveLength(3);
    regulated.forEach((pack) => {
      expect(pack.isAvailable).toBe(true);
      expect(pack.missingCodes).toEqual([]);
    });
    expect(
      regulated.find((p) => p.id === 'tmg-regulated-avista-chancel')?.orderCodes,
    ).toEqual(['PSReport12', 'CDSRegWDR', 'GSAvistaR', 'FTResCR']);
  });

  it('should offer every pack tmGroup quoted', () => {
    const resolved = resolveTmGroupPacks();

    expect(resolved).toHaveLength(6);
    expect(resolved.every((pack) => pack.isAvailable)).toBe(true);
  });

  it('should report no missing codes now every quoted code resolves', () => {
    const missing = missingTmGroupCodes();

    // Three on 2026-08-26, one on 2026-08-28, none now. Two were our own
    // curation gap; the third was an account activation on tmGroup's side.
    expect(missing).toEqual([]);
    // Aliased codes are resolved, not reported missing.
    expect(missing).not.toContain('LLC1');
    expect(missing).not.toContain('Con29');
    expect(missing).not.toContain('CDSCH500KR');
  });

  it('should never expose a pack price to a caller that renders', () => {
    // tmGroup's quoted pack prices are their price to us, and this module ships
    // in the public bundle, so a pack carries no price field of any kind.
    const resolved = resolveTmGroupPacks();
    resolved.forEach((pack) => {
      expect(Object.keys(pack).filter((key) => /pence|price|gbp/i.test(key))).toEqual([]);
    });
  });
});
