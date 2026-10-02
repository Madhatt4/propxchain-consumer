// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  del: vi.fn(),
  eq: vi.fn(),
  pushPlatform: vi.fn(),
  getPushToken: vi.fn(),
  deletePushToken: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: m.rpc,
    from: () => ({ delete: () => ({ eq: m.eq }) }),
  },
}));
vi.mock('@/lib/pushNotifications', () => ({
  pushPlatform: m.pushPlatform,
  getPushToken: m.getPushToken,
  deletePushToken: m.deletePushToken,
}));

import { registerDevicePushToken, removeDevicePushToken } from '../devicePushToken.service';

describe('devicePushToken.service', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.pushPlatform.mockReturnValue('ios');
    m.getPushToken.mockResolvedValue('device-token-0123456789');
    m.rpc.mockResolvedValue({ error: null });
    m.eq.mockResolvedValue({ error: null });
    m.deletePushToken.mockResolvedValue(undefined);
  });

  it('does nothing on the web', async () => {
    m.pushPlatform.mockReturnValue(null);
    expect(await registerDevicePushToken()).toBe(false);
    await removeDevicePushToken();
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.deletePushToken).not.toHaveBeenCalled();
  });

  it('registers the phone through the server function with its platform', async () => {
    expect(await registerDevicePushToken()).toBe(true);
    expect(m.rpc).toHaveBeenCalledWith('register_device_push_token', {
      p_token: 'device-token-0123456789',
      p_platform: 'ios',
    });
  });

  it('uses a token it is handed instead of asking again', async () => {
    await registerDevicePushToken('fresh-token-0123456789');
    expect(m.getPushToken).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith('register_device_push_token', expect.objectContaining({ p_token: 'fresh-token-0123456789' }));
  });

  it('reports false when there is no token or the server refuses', async () => {
    m.getPushToken.mockResolvedValueOnce(null);
    expect(await registerDevicePushToken()).toBe(false);
    m.rpc.mockResolvedValueOnce({ error: { message: 'no' } });
    expect(await registerDevicePushToken()).toBe(false);
  });

  it('on sign-out removes the server row and the Firebase token', async () => {
    await removeDevicePushToken();
    expect(m.eq).toHaveBeenCalledWith('token', 'device-token-0123456789');
    expect(m.deletePushToken).toHaveBeenCalled();
  });

  it('still clears the Firebase token if the server delete throws', async () => {
    m.eq.mockRejectedValueOnce(new Error('offline'));
    await expect(removeDevicePushToken()).rejects.toThrow('offline');
    expect(m.deletePushToken).toHaveBeenCalled();
  });
});
