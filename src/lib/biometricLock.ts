// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { BiometricAuth, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { secureSessionStorage } from './secureSessionStorage';

/**
 * Face ID / fingerprint lock for the native app. Unlocking is a local check
 * on the phone: nothing is sent anywhere and nothing is written to the audit
 * trail.
 */

const PREF_KEY = 'biometric_lock';

export type UnlockResult = 'unlocked' | 'cancelled' | 'failed';

/** True when the phone can ask for Face ID, fingerprint or the device passcode. */
export async function canLockDevice(): Promise<boolean> {
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

/** The lock is on unless the person has switched it off. */
export async function isLockEnabled(): Promise<boolean> {
  try {
    return (await secureSessionStorage.getItem(PREF_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await secureSessionStorage.removeItem(PREF_KEY);
  } else {
    await secureSessionStorage.setItem(PREF_KEY, 'off');
  }
}

/** Ask the phone to confirm it is the owner. The device passcode is the fallback. */
export async function promptUnlock(): Promise<UnlockResult> {
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock PropXchain',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'Unlock PropXchain',
    });
    return 'unlocked';
  } catch (err) {
    const code = (err as { code?: BiometryErrorType }).code;
    if (code === BiometryErrorType.userCancel || code === BiometryErrorType.systemCancel || code === BiometryErrorType.appCancel) {
      return 'cancelled';
    }
    return 'failed';
  }
}
