// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { decideRoleSelection, shouldSendToRoleSelection, type RoleSelectionInput } from '../onboardingRedirect';

const settledNewUser = (over: Partial<RoleSelectionInput> = {}): RoleSelectionInput => ({
  adminLoading: false,
  adminError: false,
  isAdmin: false,
  txLoading: false,
  txError: null,
  txCount: 0,
  metadata: { propxchain_needs_onboarding: true },
  authMethod: 'supabase',
  ...over,
});

describe('decideRoleSelection', () => {
  it('should send a new user with needs_onboarding, no transactions, not admin and not onboarded to role selection', () => {
    const input = settledNewUser();

    const decision = decideRoleSelection(input);

    expect(decision).toBe('role-selection');
    expect(shouldSendToRoleSelection(input)).toBe(true);
  });

  it('should keep an admin with no transactions on the dashboard', () => {
    const input = settledNewUser({ isAdmin: true });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should wait rather than redirect while the admin check is still loading', () => {
    const input = settledNewUser({ adminLoading: true });

    expect(decideRoleSelection(input)).toBe('wait');
    expect(shouldSendToRoleSelection(input)).toBe(false);
  });

  it('should keep the user on the dashboard when the admin check failed', () => {
    const input = settledNewUser({ adminError: true });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should wait rather than redirect while transactions are still loading', () => {
    const input = settledNewUser({ txLoading: true });

    expect(decideRoleSelection(input)).toBe('wait');
  });

  it('should keep a user who has a transaction on the dashboard even when needs_onboarding is true', () => {
    const input = settledNewUser({ txCount: 1 });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should keep the user on the dashboard when the transactions load failed', () => {
    const input = settledNewUser({ txError: 'canister unreachable' });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should keep an onboarded user on the dashboard even when needs_onboarding is still true', () => {
    const input = settledNewUser({ metadata: { propxchain_needs_onboarding: true, propxchain_onboarded: true } });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should keep a user without the needs_onboarding flag on the dashboard', () => {
    const input = settledNewUser({ metadata: {} });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should keep a user with no metadata on the dashboard', () => {
    const input = settledNewUser({ metadata: undefined });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should never send an Internet Identity user to role selection', () => {
    const input = settledNewUser({ authMethod: 'ii' });

    expect(decideRoleSelection(input)).toBe('stay');
  });

  it('should not wait on loading checks for a user who does not need onboarding', () => {
    const input = settledNewUser({ metadata: {}, adminLoading: true, txLoading: true });

    expect(decideRoleSelection(input)).toBe('stay');
  });
});
