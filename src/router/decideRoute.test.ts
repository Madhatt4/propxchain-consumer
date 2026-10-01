// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { decideRoute, type DecideRouteArgs } from './decideRoute';

const baseArgs = (): DecideRouteArgs => ({
  user: { id: 'user-1' },
  emailVerified: true,
  freshSignup: false,
});

describe('decideRoute', () => {
  it('should send a signed-out visitor to /login', () => {
    const result = decideRoute({ ...baseArgs(), user: null });
    expect(result.path).toBe('/login');
  });

  it('should send an unverified email to /verify', () => {
    const result = decideRoute({ ...baseArgs(), emailVerified: false });
    expect(result.path).toBe('/verify');
  });

  it('should send a fresh signup to /onboarding', () => {
    const result = decideRoute({ ...baseArgs(), freshSignup: true });
    expect(result.path).toBe('/onboarding');
  });

  it('should send every verified, signed-in user to the shared /dashboard', () => {
    const result = decideRoute(baseArgs());
    expect(result.path).toBe('/dashboard');
  });

  it('should put signed-out ahead of the fresh signup flag', () => {
    const result = decideRoute({ ...baseArgs(), user: null, freshSignup: true });
    expect(result.path).toBe('/login');
  });

  it('should put an unverified email ahead of the fresh signup flag', () => {
    const result = decideRoute({ ...baseArgs(), emailVerified: false, freshSignup: true });
    expect(result.path).toBe('/verify');
  });

  it('should send a verified, signed-in user in the phone app to /app', () => {
    const result = decideRoute({ ...baseArgs(), native: true });
    expect(result.path).toBe('/app');
  });

  it('should still send a signed-out visitor in the phone app to /login', () => {
    const result = decideRoute({ ...baseArgs(), user: null, native: true });
    expect(result.path).toBe('/login');
  });

  it('should still send an unverified email in the phone app to /verify', () => {
    const result = decideRoute({ ...baseArgs(), emailVerified: false, native: true });
    expect(result.path).toBe('/verify');
  });
});
