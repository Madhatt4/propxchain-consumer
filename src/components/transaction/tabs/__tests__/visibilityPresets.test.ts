// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import type { ShareParty } from '@/services/shareParty.service';
import type { ShareGrant } from '@/services/documentShare.service';
import {
  computePlan,
  derivePreset,
  planChange,
  presetTargets,
  roleLabel,
  roleLabelsFor,
  withSideConveyancers,
} from '../visibilityPresets';

const party = (principal: string, role: ShareParty['role'], side: ShareParty['side']): ShareParty => ({
  principal,
  label: `${role} — Named Person ${principal}`,
  role,
  side,
});

const buyerConv = party('bc', 'conveyancer', 'buyer');
const seller = party('s', 'seller', 'seller');
const sellerConv = party('sc', 'conveyancer', 'seller');
const agent = party('ea', 'estate_agent', 'seller');
const parties = [buyerConv, seller, sellerConv, agent];

const grant = (principal: string): ShareGrant => ({
  id: `g-${principal}`,
  transactionId: 'tx1',
  docHash: 'h',
  slotId: 'proofOfId',
  objectPath: 'shared/tx1/u/proofOfId-h.pdf',
  granteePrincipal: principal,
  status: 'active',
  createdAt: '2026-11-09T10:00:00Z',
  revokedAt: null,
  expiresAt: null,
});

const principalsOf = (ps: ShareParty[] | null): string[] | null => (ps ? ps.map((p) => p.principal).sort() : null);

describe('presetTargets', () => {
  it('should grant nobody for Nobody', () => {
    expect(presetTargets('nobody', parties, 'buyer')).toEqual([]);
  });

  it('should grant only my side conveyancer for My conveyancer', () => {
    expect(principalsOf(presetTargets('my_conveyancer', parties, 'buyer'))).toEqual(['bc']);
    expect(principalsOf(presetTargets('my_conveyancer', parties, 'seller'))).toEqual(['sc']);
  });

  it('should grant the other party plus their conveyancer for The other side, not the agent', () => {
    expect(principalsOf(presetTargets('other_side', parties, 'buyer'))).toEqual(['s', 'sc']);
  });

  it('should grant only the estate agent for Estate agent, with or without a side', () => {
    expect(principalsOf(presetTargets('estate_agent', parties, 'buyer'))).toEqual(['ea']);
    expect(principalsOf(presetTargets('estate_agent', parties, null))).toEqual(['ea']);
  });

  it('should grant every party on the deal for Everyone', () => {
    expect(principalsOf(presetTargets('everyone', parties, 'buyer'))).toEqual(['bc', 'ea', 's', 'sc']);
  });

  it('should return null for side-based presets when the user has no side', () => {
    expect(presetTargets('my_conveyancer', parties, null)).toBeNull();
    expect(presetTargets('other_side', parties, null)).toBeNull();
    expect(principalsOf(presetTargets('everyone', parties, null))).toEqual(['bc', 'ea', 's', 'sc']);
  });
});

describe('withSideConveyancers', () => {
  it('should add the seller conveyancer when sharing with the seller', () => {
    expect(principalsOf(withSideConveyancers([seller], parties))).toEqual(['s', 'sc']);
  });

  it('should not add anyone when sharing with a conveyancer or the agent', () => {
    expect(principalsOf(withSideConveyancers([agent], parties))).toEqual(['ea']);
    expect(principalsOf(withSideConveyancers([buyerConv], parties))).toEqual(['bc']);
  });
});

describe('derivePreset', () => {
  it('should read no grants as Nobody and a matching set as its preset', () => {
    expect(derivePreset([], parties, 'buyer')).toBe('nobody');
    expect(derivePreset(['bc'], parties, 'buyer')).toBe('my_conveyancer');
    expect(derivePreset(['sc', 's'], parties, 'buyer')).toBe('other_side');
    expect(derivePreset(['bc', 's', 'sc', 'ea'], parties, 'buyer')).toBe('everyone');
  });

  it('should read any other set as Custom', () => {
    expect(derivePreset(['ea'], parties, 'buyer')).toBe('estate_agent');
    expect(derivePreset(['bc', 'ea'], parties, 'buyer')).toBe('custom');
    expect(derivePreset(['departed'], parties, 'buyer')).toBe('custom');
  });
});

describe('planChange', () => {
  it('should revoke the grants a new preset drops and add only the missing ones', () => {
    const current = [grant('bc'), grant('ea')];
    const plan = planChange(current, presetTargets('other_side', parties, 'buyer') ?? []);
    expect(plan.toGrant.map((p) => p.principal).sort()).toEqual(['s', 'sc']);
    expect(plan.toRevoke.map((g) => g.granteePrincipal).sort()).toEqual(['bc', 'ea']);
  });

  it('should revoke every grant for Nobody', () => {
    const current = [grant('bc'), grant('s'), grant('sc')];
    const plan = planChange(current, []);
    expect(plan.toGrant).toEqual([]);
    expect(plan.toRevoke).toEqual(current);
  });

  it('should change nothing when the preset already holds', () => {
    expect(planChange([grant('bc')], [buyerConv])).toEqual({ toGrant: [], toRevoke: [] });
  });
});

describe('roleLabel', () => {
  it('should name roles and sides only, never the person', () => {
    expect(roleLabel(buyerConv)).toBe('Buyer’s conveyancer');
    expect(roleLabel(sellerConv)).toBe('Seller’s conveyancer');
    expect(roleLabel(seller)).toBe('Seller');
    expect(roleLabel(agent)).toBe('Estate agent');
    expect(roleLabel(party('c', 'conveyancer', null))).toBe('Conveyancer');
    expect(roleLabel(undefined)).toBe('A former party');
    expect(roleLabelsFor(['s', 'sc', 'bc'], parties).join(' ')).not.toMatch(/Named Person/);
  });
});

describe('computePlan', () => {
  it('should add the side conveyancer with a party and skip principals already granted', () => {
    const plan = computePlan({ kind: 'add', principal: 's' }, [grant('sc')], parties, 'buyer');
    expect(plan.toGrant.map((p) => p.principal)).toEqual(['s']);
    expect(plan.toRevoke).toEqual([]);
  });

  it('should grant nothing for a principal no longer on the roster', () => {
    expect(computePlan({ kind: 'add', principal: 'gone' }, [], parties, 'buyer').toGrant).toEqual([]);
  });

  it('should revoke only the named principal for remove', () => {
    const plan = computePlan({ kind: 'remove', principal: 's' }, [grant('s'), grant('sc')], parties, 'buyer');
    expect(plan.toRevoke.map((g) => g.granteePrincipal)).toEqual(['s']);
  });

  it('should change nothing for a side preset once the user has no side', () => {
    const plan = computePlan({ kind: 'preset', preset: 'other_side' }, [grant('bc')], parties, null);
    expect(plan).toEqual({ toGrant: [], toRevoke: [] });
  });
});
