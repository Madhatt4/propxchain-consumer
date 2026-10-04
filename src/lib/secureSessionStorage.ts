// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

/**
 * Storage adapter for the Supabase auth session in the native app.
 *
 * On a phone the session lives in the iOS Keychain / Android Keystore instead
 * of the WebView's localStorage. Items are kept on this device only: they do
 * not sync through iCloud Keychain and do not travel in device backups.
 *
 * The ICP identity restores from this session alone (see
 * supabase.auth.service restoreIdentity), so protecting it protects both.
 */

let ready: Promise<void> | null = null;

function init(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await SecureStorage.setKeyPrefix('propxchain_');
      await SecureStorage.setSynchronize(false);
    })().catch((err: unknown) => {
      // Do not cache a rejected init: let the next call try again.
      ready = null;
      throw err;
    });
  }
  return ready;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    await init();
    const value = await SecureStorage.get(key, false, false);
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  },

  async setItem(key: string, value: string): Promise<void> {
    await init();
    await SecureStorage.set(key, value, false, false, KeychainAccess.afterFirstUnlockThisDeviceOnly);
  },

  async removeItem(key: string): Promise<void> {
    await init();
    await SecureStorage.remove(key, false);
  },
};
