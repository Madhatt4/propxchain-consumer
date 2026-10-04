// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  setKeyPrefix: vi.fn(),
  setSynchronize: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  KeychainAccess: { afterFirstUnlockThisDeviceOnly: 2 },
  SecureStorage: m,
}));

describe('secureSessionStorage init', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(m).forEach((f) => f.mockReset());
    m.setKeyPrefix.mockResolvedValue(undefined);
    m.setSynchronize.mockResolvedValue(undefined);
    m.get.mockResolvedValue('value');
  });

  it('retries init after a failed init instead of caching the rejection', async () => {
    m.setKeyPrefix.mockRejectedValueOnce(new Error('keychain busy'));
    const { secureSessionStorage } = await import('../secureSessionStorage');

    await expect(secureSessionStorage.getItem('k')).rejects.toThrow('keychain busy');
    await expect(secureSessionStorage.getItem('k')).resolves.toBe('value');
    expect(m.setKeyPrefix).toHaveBeenCalledTimes(2);
  });

  it('runs init only once when it succeeds', async () => {
    const { secureSessionStorage } = await import('../secureSessionStorage');
    await secureSessionStorage.getItem('a');
    await secureSessionStorage.getItem('b');
    expect(m.setKeyPrefix).toHaveBeenCalledTimes(1);
  });
});
