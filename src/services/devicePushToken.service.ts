// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { supabase } from '@/lib/supabase';
import { deletePushToken, getPushToken, pushPlatform } from '@/lib/pushNotifications';

/**
 * Keeps this phone's push address on the server so the Move Narrator can
 * reach the signed-in person. Native app only.
 */

/** Register (or refresh) this phone for the signed-in user. Returns false if push is unavailable. */
export async function registerDevicePushToken(knownToken?: string): Promise<boolean> {
  const platform = pushPlatform();
  if (!platform) return false;
  const token = knownToken ?? (await getPushToken());
  if (!token) return false;
  const { error } = await supabase.rpc('register_device_push_token', {
    p_token: token,
    p_platform: platform,
  });
  return !error;
}

/**
 * Remove this phone from the server and from Firebase. Call this BEFORE
 * signing out: it needs the signed-in session to be allowed to delete the row.
 */
export async function removeDevicePushToken(): Promise<void> {
  if (!pushPlatform()) return;
  try {
    const token = await getPushToken();
    if (token) {
      await supabase.from('device_push_tokens').delete().eq('token', token);
    }
  } finally {
    await deletePushToken();
  }
}
