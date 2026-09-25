import { describe, it, expect } from 'vitest';
import type { AmlCheck } from '@/services/aml.service';
import type { ShareParty } from '@/services/shareParty.service';
import { checkableParties, hasLiveCheck, latestCheckFor, panelProviderName, statusView, withMe } from '../amlStatus';

function check(overrides: Partial<AmlCheck>): AmlCheck {
  return {
    id: 'c1',
    transactionId: 'TX-1',
    subjectPrincipal: 'p1',
    tier: 'standard',
    status: 'in_progress',
    paymentStatus: 'paid',
    retailPence: 1234,
    createdAt: '2026-08-25T10:00:00Z',
    completedAt: null,
    hasReport: false,
    provider: 'verify365',
    ...overrides,
  };
}

const baseCheck = check({});

describe('amlStatus', () => {
  describe('checkableParties', () => {
    it('should keep buyers and sellers and drop advisers', () => {
      const parties: ShareParty[] = [
        { principal: 'b', label: 'Buyer — A', role: 'buyer', side: 'buyer' },
        { principal: 'c', label: 'Conveyancer — Firm', role: 'conveyancer', side: 'buyer' },
        { principal: 's', label: 'Seller — B', role: 'seller', side: 'seller' },
        { principal: 'e', label: 'Estate agent — X', role: 'estate_agent', side: 'seller' },
      ];
      expect(checkableParties(parties).map((p) => p.principal)).toEqual(['b', 's']);
    });
  });

  describe('withMe', () => {
    const others: ShareParty[] = [{ principal: 'b', label: 'Buyer — A', role: 'buyer', side: 'buyer' }];

    it('should put my own card first, labelled by my side, when I am a buyer or seller', () => {
      expect(withMe({ mySide: 'seller', parties: others }, 'me')).toEqual([
        { principal: 'me', label: 'Seller', role: 'seller', side: 'seller' },
        ...others,
      ]);
    });

    it('should leave the roster alone when I am not a buyer or seller', () => {
      expect(withMe({ mySide: null, parties: others }, 'me')).toEqual(others);
    });

    it('should not list me twice if the roster already carries my principal', () => {
      const withMeAlready = [...others, { principal: 'me', label: 'Seller — X', role: 'seller' as const, side: 'seller' as const }];
      const result = withMe({ mySide: 'seller', parties: withMeAlready }, 'me');
      expect(result.filter((p) => p.principal === 'me')).toHaveLength(1);
    });
  });

  describe('latestCheckFor', () => {
    it('should return null when the person has no checks', () => {
      expect(latestCheckFor([check({ subjectPrincipal: 'other' })], 'p1')).toBeNull();
    });

    it('should return the newest check for the person', () => {
      const older = check({ id: 'old', createdAt: '2026-08-20T00:00:00Z', status: 'failed' });
      const newer = check({ id: 'new', createdAt: '2026-08-25T00:00:00Z' });
      expect(latestCheckFor([older, newer], 'p1')?.id).toBe('new');
    });
  });

  describe('statusView — fact, not verdict', () => {
    it('should allow starting when there is no check', () => {
      const v = statusView(null);
      expect(v.canStart).toBe(true);
      expect(v.label).toBe('Not started');
    });

    it('should show awaiting payment and allow a restart for an unpaid pending row', () => {
      const v = statusView(check({ status: 'pending', paymentStatus: 'unpaid' }));
      expect(v.label).toBe('Awaiting payment');
      expect(v.canStart).toBe(true);
    });

    it('should not allow a second order while a paid check is being placed', () => {
      expect(statusView(check({ status: 'pending', paymentStatus: 'paid' })).canStart).toBe(false);
    });

    it('should show in progress without a wallet link', () => {
      const v = statusView(check({ status: 'in_progress' }));
      expect(v.tone).toBe('busy');
      expect(v.showWalletLink).toBe(false);
      expect(v.canStart).toBe(false);
    });

    it('should link to the wallet only once the report has landed', () => {
      expect(statusView(check({ status: 'complete', hasReport: false })).showWalletLink).toBe(false);
      expect(statusView(check({ status: 'complete', hasReport: true })).showWalletLink).toBe(true);
    });

    it('should never describe a person as passed, failed, verified or approved', () => {
      const all = [null, check({ status: 'pending' }), check({ status: 'in_progress' }), check({ status: 'complete', hasReport: true }), check({ status: 'failed' })];
      for (const c of all) {
        const v = statusView(c);
        expect(`${v.label} ${v.detail}`).not.toMatch(/\b(passed|failed|verified|approved|rejected)\b/i);
      }
    });

    it('should allow a new order after a check could not be completed', () => {
      const v = statusView(check({ status: 'failed' }));
      expect(v.tone).toBe('problem');
      expect(v.canStart).toBe(true);
    });

    it('should name the provider from the check rather than a hardcoded constant', () => {
      const view = statusView({ ...baseCheck, status: 'in_progress', provider: 'acme-aml' });
      expect(view.detail).toContain('acme-aml');
      expect(view.detail).not.toContain('Verify 365');
    });
  });

  describe('panelProviderName', () => {
    const declared = { id: 'verify365', name: 'Verify 365' };

    it('should use the worker-declared provider before any check exists', () => {
      expect(panelProviderName(declared, null)).toBe('Verify 365');
    });

    it('should let an existing check name its own provider over the declaration', () => {
      expect(panelProviderName(declared, check({ provider: 'acme-aml' }))).toBe('acme-aml');
    });

    it('should fall back to anonymous wording when nothing names a provider', () => {
      expect(panelProviderName(null, null)).toBe('our verification partner');
      expect(panelProviderName({ id: 'x', name: '' }, null)).toBe('our verification partner');
    });
  });

  describe('hasLiveCheck', () => {
    it('should be true only while something is moving', () => {
      expect(hasLiveCheck([check({ status: 'in_progress' })])).toBe(true);
      expect(hasLiveCheck([check({ status: 'pending', paymentStatus: 'paid' })])).toBe(true);
      expect(hasLiveCheck([check({ status: 'pending', paymentStatus: 'unpaid' })])).toBe(false);
      expect(hasLiveCheck([check({ status: 'complete' }), check({ status: 'failed' })])).toBe(false);
      expect(hasLiveCheck([])).toBe(false);
    });
  });
});
