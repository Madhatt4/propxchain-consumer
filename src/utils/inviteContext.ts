// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * inviteContext — the role / side / inviter hints carried on a join link
 * (wallet spec decision 15). Pure UI grouping hints, never an access grant:
 * access is still the on-chain join; these only decide how the joiner is
 * labelled and which side of the deal they appear on.
 */
import type { DealSide, PartyRole } from '@/services/shareParty.service';

export type InviteRole = PartyRole;

export const INVITE_ROLE_OPTIONS: ReadonlyArray<{ value: InviteRole; label: string }> = [
  { value: 'seller', label: 'Seller' },
  { value: 'estate_agent', label: 'Estate agent' },
  { value: 'conveyancer', label: 'Conveyancer / solicitor' },
  { value: 'mortgage_broker', label: 'Mortgage broker' },
  { value: 'lender', label: 'Lender' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'other', label: 'Someone else' },
];

export interface InviteContext {
  role?: InviteRole;
  side?: DealSide;
  invitedBy?: string;
}

const ROLES = new Set(INVITE_ROLE_OPTIONS.map((o) => o.value));

/** Append role/side/by to a join URL. Leaves the URL untouched when nothing is set. */
export function withInviteContext(url: string, ctx: InviteContext): string {
  const u = new URL(url);
  if (ctx.role) u.searchParams.set('role', ctx.role);
  if (ctx.side) u.searchParams.set('side', ctx.side);
  if (ctx.invitedBy) u.searchParams.set('by', ctx.invitedBy);
  return u.toString();
}

/** Read the hints back off a join URL's search params; unknown values are dropped. */
export function readInviteContext(params: URLSearchParams): InviteContext {
  const role = params.get('role') ?? '';
  const side = params.get('side') ?? '';
  const by = params.get('by') ?? '';
  return {
    ...(ROLES.has(role as InviteRole) ? { role: role as InviteRole } : {}),
    ...(side === 'buyer' || side === 'seller' ? { side } : {}),
    ...(by ? { invitedBy: by } : {}),
  };
}
