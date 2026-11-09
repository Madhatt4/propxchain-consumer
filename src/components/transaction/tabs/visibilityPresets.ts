// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * visibilityPresets — the "Who can see this" choices for a personal wallet
 * document on a deal (Marc, 2026-11-09). Every choice resolves to a set of
 * roster principals; the existing per-principal grants are then added or
 * revoked to match, so there is no parallel permission model to drift.
 */
import type { DealSide, ShareParty } from '@/services/shareParty.service';
import type { ShareGrant } from '@/services/documentShare.service';

export type VisibilityPreset = 'nobody' | 'my_conveyancer' | 'other_side' | 'everyone' | 'custom';

export const PRESET_LABELS: Record<VisibilityPreset, string> = {
  nobody: 'Nobody',
  my_conveyancer: 'My conveyancer',
  other_side: 'The other side',
  everyone: 'Everyone on the deal',
  custom: 'Custom',
};

/** Presets whose membership is computed; 'custom' is whatever the switches say. */
const COMPUTED: readonly Exclude<VisibilityPreset, 'custom'>[] = ['nobody', 'my_conveyancer', 'other_side', 'everyone'];

const oppositeOf = (side: DealSide): DealSide => (side === 'buyer' ? 'seller' : 'buyer');

const isPrincipalParty = (p: ShareParty): boolean => p.role === 'buyer' || p.role === 'seller';

/** The conveyancers acting for one side of the deal. */
export function conveyancersFor(side: DealSide, parties: ShareParty[]): ShareParty[] {
  return parties.filter((p) => p.role === 'conveyancer' && p.side === side);
}

/**
 * The parties a preset grants to. Returns null when the preset cannot apply
 * (no side, so no "my conveyancer" or "other side"), which the UI disables.
 */
export function presetTargets(
  preset: Exclude<VisibilityPreset, 'custom'>,
  parties: ShareParty[],
  mySide: DealSide | null,
): ShareParty[] | null {
  if (preset === 'nobody') return [];
  if (preset === 'everyone') return parties;
  if (!mySide) return null;
  if (preset === 'my_conveyancer') return conveyancersFor(mySide, parties);
  const other = oppositeOf(mySide);
  // Their party plus their conveyancer only — the agent and lenders are not "a side".
  return parties.filter((p) => p.side === other && (isPrincipalParty(p) || p.role === 'conveyancer'));
}

/**
 * Sharing with a buyer or seller also reaches that side's conveyancer
 * (Marc, 2026-11-09): conveyancers act on their client's documents, so a
 * share that skips them only creates a forwarding chore.
 */
export function withSideConveyancers(targets: ShareParty[], parties: ShareParty[]): ShareParty[] {
  const out = new Map(targets.map((p) => [p.principal, p]));
  for (const p of targets) {
    if (isPrincipalParty(p) && p.side) {
      for (const c of conveyancersFor(p.side, parties)) out.set(c.principal, c);
    }
  }
  return [...out.values()];
}

const sameSet = (a: Set<string>, b: string[]): boolean => a.size === b.length && b.every((x) => a.has(x));

/** Which preset the document's current grants amount to; 'custom' when none fits. */
export function derivePreset(
  grantedPrincipals: string[],
  parties: ShareParty[],
  mySide: DealSide | null,
): VisibilityPreset {
  const granted = new Set(grantedPrincipals);
  if (granted.size === 0) return 'nobody';
  for (const preset of COMPUTED) {
    const targets = presetTargets(preset, parties, mySide);
    if (targets && targets.length > 0 && sameSet(granted, targets.map((t) => t.principal))) return preset;
  }
  return 'custom';
}

export interface GrantPlan {
  toGrant: ShareParty[];
  toRevoke: ShareGrant[];
}

/** The grants to add and revoke so a document is visible to exactly `targets`. */
export function planChange(current: ShareGrant[], targets: ShareParty[]): GrantPlan {
  const wanted = new Set(targets.map((t) => t.principal));
  const have = new Set(current.map((g) => g.granteePrincipal));
  return {
    toGrant: targets.filter((t) => !have.has(t.principal)),
    toRevoke: current.filter((g) => !wanted.has(g.granteePrincipal)),
  };
}

/**
 * A role-only label ("Seller's conveyancer"). Never a name or firm: this is
 * what the owner sees about who holds their personal data, and the dialog
 * that confirms a share must not leak one party's identity to another.
 */
export function roleLabel(party: ShareParty | undefined): string {
  if (!party) return 'A former party';
  const side = party.side === 'buyer' ? 'Buyer’s' : party.side === 'seller' ? 'Seller’s' : null;
  switch (party.role) {
    case 'buyer':
      return 'Buyer';
    case 'seller':
      return 'Seller';
    case 'conveyancer':
      return side ? `${side} conveyancer` : 'Conveyancer';
    case 'estate_agent':
      return 'Estate agent';
    case 'mortgage_broker':
      return side ? `${side} mortgage broker` : 'Mortgage broker';
    case 'lender':
      return side ? `${side} lender` : 'Lender';
    default:
      return 'Other participant';
  }
}

/** Distinct role labels, in roster order, for a list of principals. */
export function roleLabelsFor(principals: string[], parties: ShareParty[]): string[] {
  const byPrincipal = new Map(parties.map((p) => [p.principal, p]));
  return [...new Set(principals.map((p) => roleLabel(byPrincipal.get(p))))];
}

/** "A", "A and B", "A, B and C". */
export function joinRoles(roles: string[]): string {
  if (roles.length <= 1) return roles[0] ?? '';
  return `${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]}`;
}
