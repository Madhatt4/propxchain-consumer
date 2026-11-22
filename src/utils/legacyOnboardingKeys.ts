// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export const LEGACY_ONBOARDING_STORAGE_KEYS = ['needsOnboarding', 'onboardingComplete'] as const;

export function clearLegacyOnboardingKeys(): void {
  for (const key of LEGACY_ONBOARDING_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
