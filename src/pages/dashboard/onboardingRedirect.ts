// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export type RoleSelectionDecision = 'wait' | 'stay' | 'role-selection';

export interface RoleSelectionInput {
  adminLoading: boolean;
  isAdmin: boolean;
  txLoading: boolean;
  txError: string | null;
  txCount: number;
  metadata: Record<string, unknown> | null | undefined;
  authMethod: 'supabase' | 'ii' | null;
}

export function decideRoleSelection(input: RoleSelectionInput): RoleSelectionDecision {
  if (input.authMethod !== 'supabase') return 'stay';
  if (input.metadata?.propxchain_needs_onboarding !== true) return 'stay';
  if (input.adminLoading || input.txLoading) return 'wait';
  if (input.txError) return 'stay';
  if (input.txCount > 0 || input.isAdmin) return 'stay';
  if (input.metadata?.propxchain_onboarded === true) return 'stay';
  return 'role-selection';
}

export function shouldSendToRoleSelection(input: RoleSelectionInput): boolean {
  return decideRoleSelection(input) === 'role-selection';
}
