// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, expect, it } from 'vitest';
import {
  DEAL_ACCESS,
  SECTION_ITEM,
  STAGE_ITEM,
  accessFor,
  accessForId,
  canAct,
  dealSideOf,
  delegatePairsOf,
  principalsOf,
} from '../dealAccess';
import { TRANSACTION_TABS } from '@/components/transaction/tabs/transactionTabs.config';
import { getStagesForJourney } from '@/utils/stageConfig';

describe('dealSideOf', () => {
  const parties = { seller: 'S', buyer: 'B' };

  it('finds the seller and the buyer', () => {
    expect(dealSideOf(parties, 'S')).toBe('seller');
    expect(dealSideOf(parties, 'B')).toBe('buyer');
  });

  it('puts anyone else on the deal on the other side', () => {
    expect(dealSideOf(parties, 'AGENT')).toBe('other');
  });

  it('treats buyer === seller as "no buyer yet"', () => {
    expect(dealSideOf({ seller: 'S', buyer: 'S' }, 'S')).toBe('seller');
  });

  it('reads the multi-party lists', () => {
    const multi = { ...parties, sellers: ['S2'], buyers: ['B2'] };
    expect(dealSideOf(multi, 'S2')).toBe('seller');
    expect(dealSideOf(multi, 'B2')).toBe('buyer');
  });

  it('gives a signed-out viewer nothing to act on', () => {
    expect(dealSideOf(parties, null)).toBe('other');
  });

  it("puts a delegate on their client's side", () => {
    expect(dealSideOf({ ...parties, delegates: [['S', 'AGENT']] }, 'AGENT')).toBe('seller');
    expect(dealSideOf({ ...parties, delegates: [['B', 'AGENT']] }, 'AGENT')).toBe('buyer');
  });

  it('keeps a delegate for both sides, or for nobody on the deal, on the other side', () => {
    expect(dealSideOf({ ...parties, delegates: [['S', 'AGENT'], ['B', 'AGENT']] }, 'AGENT')).toBe('other');
    expect(dealSideOf({ ...parties, delegates: [['GONE', 'AGENT']] }, 'AGENT')).toBe('other');
  });
});

describe('the access map', () => {
  it('lets the buyer see the sales pack but not act on it', () => {
    expect(accessFor('salesPack', 'buyer')).toBe('view');
    expect(canAct('salesPack', 'seller')).toBe(true);
  });

  it('keeps the property forms read-only for the buyer', () => {
    expect(canAct('propertyForms', 'buyer')).toBe(false);
    expect(canAct('propertyForms', 'other')).toBe(true);
  });

  it('has a level for every stage in both journeys', () => {
    const ids = [...getStagesForJourney('seller'), ...getStagesForJourney('buyer')].map((s) => s.id);
    for (const id of ids) expect(STAGE_ITEM[id], id).toBeDefined();
  });

  it('has a level for every section except the overview', () => {
    for (const tab of TRANSACTION_TABS) {
      if (tab.id === 'overview') continue;
      expect(SECTION_ITEM[tab.id], tab.id).toBeDefined();
    }
  });

  it('lets only the seller delete the deal', () => {
    expect(canAct('deleteDeal', 'seller')).toBe(true);
    expect(accessFor('deleteDeal', 'buyer')).toBe('hidden');
    expect(accessFor('deleteDeal', 'other')).toBe('hidden');
  });

    it('leaves ids it does not know unlocked', () => {
    expect(accessForId('overview', 'buyer')).toBe('act');
    expect(accessForId('sales-pack-0', 'buyer')).toBe('view');
  });

  it('gives every item a level for every side', () => {
    for (const row of Object.values(DEAL_ACCESS)) {
      expect(Object.keys(row).sort()).toEqual(['buyer', 'other', 'seller']);
    }
  });
});

describe('delegatePairsOf', () => {
  it('turns principal pairs into text', () => {
    const p = (t: string) => ({ toString: () => t });
    expect(delegatePairsOf([[p('S'), p('A')]])).toEqual([['S', 'A']]);
    expect(delegatePairsOf(undefined)).toEqual([]);
  });
});

describe('principalsOf', () => {
  it('unwraps the optional party list', () => {
    expect(principalsOf([[{ principal: { toString: () => 'P1' } }]])).toEqual(['P1']);
    expect(principalsOf([])).toEqual([]);
    expect(principalsOf(undefined)).toEqual([]);
  });
});
