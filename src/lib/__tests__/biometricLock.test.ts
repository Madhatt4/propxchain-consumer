// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  setSynchronize: vi.fn(),
  setKeyPrefix: vi.fn(),
  checkBiometry: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    get: m.get,
    set: m.set,
    remove: m.remove,
    setSynchronize: m.setSynchronize,
    setKeyPrefix: m.setKeyPrefix,
  },
  KeychainAccess: { afterFirstUnlockThisDeviceOnly: 3 },
}));

vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometricAuth: { checkBiometry: m.checkBiometry, authenticate: m.authenticate },
  BiometryErrorType: { userCancel: 'userCancel', systemCancel: 'systemCancel', appCancel: 'appCancel' },
}));

import { secureSessionStorage } from '../secureSessionStorage';
import { canLockDevice, isLockEnabled, setLockEnabled, promptUnlock } from '../biometricLock';

describe('secureSessionStorage', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
  });

  it('keeps items on this device only: no iCloud sync, after-first-unlock this-device access', async () => {
    await secureSessionStorage.setItem('sb-session', '{"a":1}');
    expect(m.setKeyPrefix).toHaveBeenCalledWith('propxchain_');
    expect(m.setSynchronize).toHaveBeenCalledWith(false);
    expect(m.set).toHaveBeenCalledWith('sb-session', '{"a":1}', false, false, 3);
  });

  it('returns stored strings unchanged and null when missing', async () => {
    m.get.mockResolvedValueOnce('{"a":1}').mockResolvedValueOnce(null);
    expect(await secureSessionStorage.getItem('k')).toBe('{"a":1}');
    expect(await secureSessionStorage.getItem('k')).toBeNull();
  });

  it('turns a parsed object back into a JSON string for supabase', async () => {
    m.get.mockResolvedValueOnce({ a: 1 });
    expect(await secureSessionStorage.getItem('k')).toBe('{"a":1}');
  });

  it('removes items', async () => {
    await secureSessionStorage.removeItem('k');
    expect(m.remove).toHaveBeenCalledWith('k', false);
  });
});

describe('biometricLock', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
  });

  it('canLockDevice reflects the phone, and is false if the check throws', async () => {
    m.checkBiometry.mockResolvedValueOnce({ isAvailable: true });
    expect(await canLockDevice()).toBe(true);
    m.checkBiometry.mockRejectedValueOnce(new Error('x'));
    expect(await canLockDevice()).toBe(false);
  });

  it('the lock is on by default and off only when switched off', async () => {
    m.get.mockResolvedValueOnce(null);
    expect(await isLockEnabled()).toBe(true);
    m.get.mockResolvedValueOnce('off');
    expect(await isLockEnabled()).toBe(false);
  });

  it('writes off, and clears the setting to turn it back on', async () => {
    await setLockEnabled(false);
    expect(m.set).toHaveBeenCalledWith('biometric_lock', 'off', false, false, 3);
    await setLockEnabled(true);
    expect(m.remove).toHaveBeenCalledWith('biometric_lock', false);
  });

  it('promptUnlock allows the device passcode as a fallback', async () => {
    m.authenticate.mockResolvedValueOnce(undefined);
    expect(await promptUnlock()).toBe('unlocked');
    expect(m.authenticate).toHaveBeenCalledWith(expect.objectContaining({ allowDeviceCredential: true }));
  });

  it('maps cancel and failure', async () => {
    m.authenticate.mockRejectedValueOnce(Object.assign(new Error('c'), { code: 'userCancel' }));
    expect(await promptUnlock()).toBe('cancelled');
    m.authenticate.mockRejectedValueOnce(Object.assign(new Error('f'), { code: 'authenticationFailed' }));
    expect(await promptUnlock()).toBe('failed');
  });
});
