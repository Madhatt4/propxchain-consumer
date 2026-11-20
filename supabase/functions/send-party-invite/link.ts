// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// The link an emailed party invite opens. Pure; tested in link.test.ts.
//
// The deal's invite code is the buyer's way in only (Marc, 2026-11-19). A
// seller takes over an agent-led sale by signing in with the invited email and
// accepting on /seller-invite/<transactionId>, so their link and email never
// carry the code. Only buyers and sellers are invited here: estate agents come
// in through the seller's agent invite and conveyancers through an accepted
// estimate, so no other role is ever sent the code.

export const SITE = 'https://propxchain.com';

export const INVITE_ROLES = ['buyer', 'seller'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export function isInviteRole(role: unknown): role is InviteRole {
  return typeof role === 'string' && (INVITE_ROLES as readonly string[]).includes(role);
}

export interface InviteLinkInput {
  role: string;
  transactionId: string;
  inviteCode: string;
  side?: 'buyer' | 'seller';
  invitedByPrincipal: string;
}

export function inviteLink(input: InviteLinkInput): string {
  if (input.role === 'seller') {
    return `${SITE}/seller-invite/${encodeURIComponent(input.transactionId)}`;
  }
  return `${SITE}/join/${encodeURIComponent(input.inviteCode)}?role=${input.role}&side=${input.side ?? ''}&by=${input.invitedByPrincipal}`;
}

/** The line under the button. The seller's accept checks the signed-in email, so say which one to use. */
export function inviteFootnote(role: string): string {
  if (role === 'seller') {
    return 'Sign in, or create your free PropXchain account, with this email address to take over your sale.';
  }
  return 'Create your free PropXchain account to open your sale — it takes a minute.';
}
