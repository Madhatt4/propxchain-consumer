// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

/**
 * Thin wrapper over the native push plugin. Push is a nudge, not a record:
 * nothing here is written to the audit trail.
 */

export type PushPermission = 'granted' | 'denied' | 'prompt';

export function pushPlatform(): 'ios' | 'android' | null {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
}

export async function getPushPermission(): Promise<PushPermission> {
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === 'granted') return 'granted';
    if (receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
}

/** Ask the person for permission. Call this from a button, never on launch. */
export async function requestPushPermission(): Promise<PushPermission> {
  try {
    const { receive } = await FirebaseMessaging.requestPermissions();
    return receive === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** The phone's push address, or null if push is not set up on this build. */
export async function getPushToken(): Promise<string | null> {
  try {
    const { token } = await FirebaseMessaging.getToken();
    return token || null;
  } catch {
    return null;
  }
}

export async function deletePushToken(): Promise<void> {
  try {
    await FirebaseMessaging.deleteToken();
  } catch {
    // Best effort: the server also drops tokens Firebase reports as dead.
  }
}

/** Tokens can be reissued by the system; keep the server copy current. */
export function onPushTokenRefreshed(listener: (token: string) => void): () => void {
  const handle = FirebaseMessaging.addListener('tokenReceived', ({ token }) => listener(token));
  return () => {
    void handle.then((h) => h.remove());
  };
}

/** Fires when the person taps a notification. Gives back the data fields only. */
export function onPushTapped(listener: (data: Record<string, unknown>) => void): () => void {
  const handle = FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
    const data = notification?.data;
    listener(data && typeof data === 'object' ? (data as Record<string, unknown>) : {});
  });
  return () => {
    void handle.then((h) => h.remove());
  };
}
