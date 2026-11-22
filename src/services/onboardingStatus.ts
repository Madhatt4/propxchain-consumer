// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

export const NEEDS_ONBOARDING_KEY = 'propxchain_needs_onboarding';
export const ONBOARDED_KEY = 'propxchain_onboarded';

type OnboardingMetadataPatch = Partial<Record<typeof NEEDS_ONBOARDING_KEY | typeof ONBOARDED_KEY, boolean>>;

function isStillSignedInAs(userId: string): boolean {
  const { authMethod, supabaseUser } = useAuthStore.getState();
  return authMethod === 'supabase' && supabaseUser?.id === userId;
}

async function writeOnboardingMetadata(patch: OnboardingMetadataPatch): Promise<void> {
  if (useAuthStore.getState().authMethod !== 'supabase') return;
  try {
    const { data, error } = await supabase.auth.updateUser({ data: patch });
    if (error) {
      logger.warn('Onboarding status: user metadata write failed', error);
      return;
    }
    if (data.user && isStillSignedInAs(data.user.id)) useAuthStore.setState({ supabaseUser: data.user });
  } catch (err) {
    logger.warn('Onboarding status: user metadata write threw', err);
  }
}

export function markUserNeedsOnboarding(): Promise<void> {
  return writeOnboardingMetadata({ [NEEDS_ONBOARDING_KEY]: true });
}

export function markUserOnboarded(): Promise<void> {
  return writeOnboardingMetadata({ [ONBOARDED_KEY]: true, [NEEDS_ONBOARDING_KEY]: false });
}
