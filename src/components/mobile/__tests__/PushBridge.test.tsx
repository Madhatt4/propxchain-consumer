// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  getPushPermission: vi.fn(),
  onPushTapped: vi.fn(),
  onPushTokenRefreshed: vi.fn(),
  register: vi.fn(),
  navigate: vi.fn(),
  auth: { isAuthenticated: true },
}));

vi.mock('@/lib/native', () => ({ isNativeApp: m.isNativeApp }));
vi.mock('@/lib/pushNotifications', () => ({
  getPushPermission: m.getPushPermission,
  onPushTapped: m.onPushTapped,
  onPushTokenRefreshed: m.onPushTokenRefreshed,
}));
vi.mock('@/services/devicePushToken.service', () => ({ registerDevicePushToken: m.register }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: typeof m.auth) => unknown) => sel(m.auth),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => m.navigate }));

import PushBridge from '../PushBridge';
import { pushTapDestination } from '@/lib/pushTapDestination';

describe('pushTapDestination', () => {
  it('opens the transaction flow for a valid id', () => {
    expect(pushTapDestination({ txId: 'tx-abc_123' })).toBe('/transaction/tx-abc_123/flow');
  });

  it('ignores missing, non-string and unsafe ids', () => {
    expect(pushTapDestination({})).toBeNull();
    expect(pushTapDestination({ txId: 42 })).toBeNull();
    expect(pushTapDestination({ txId: '../../admin' })).toBeNull();
    expect(pushTapDestination({ txId: 'a b' })).toBeNull();
    expect(pushTapDestination({ txId: 'x'.repeat(65) })).toBeNull();
  });
});

describe('PushBridge', () => {
  let tapListener: (d: Record<string, unknown>) => void;
  let refreshListener: (t: string) => void;

  beforeEach(() => {
    Object.values(m).forEach((f) => typeof f === 'function' && (f as ReturnType<typeof vi.fn>).mockReset());
    m.auth.isAuthenticated = true;
    m.isNativeApp.mockReturnValue(true);
    m.getPushPermission.mockResolvedValue('granted');
    m.register.mockResolvedValue(true);
    m.onPushTapped.mockImplementation((cb: typeof tapListener) => {
      tapListener = cb;
      return () => {};
    });
    m.onPushTokenRefreshed.mockImplementation((cb: typeof refreshListener) => {
      refreshListener = cb;
      return () => {};
    });
  });

  it('does nothing outside the native app', () => {
    m.isNativeApp.mockReturnValue(false);
    render(<PushBridge />);
    expect(m.getPushPermission).not.toHaveBeenCalled();
    expect(m.onPushTapped).not.toHaveBeenCalled();
  });

  it('registers this phone once signed in and allowed', async () => {
    render(<PushBridge />);
    await waitFor(() => expect(m.register).toHaveBeenCalledTimes(1));
  });

  it('does not register before the person allows notifications', async () => {
    m.getPushPermission.mockResolvedValue('prompt');
    render(<PushBridge />);
    await waitFor(() => expect(m.getPushPermission).toHaveBeenCalled());
    expect(m.register).not.toHaveBeenCalled();
  });

  it('does not register when signed out', async () => {
    m.auth.isAuthenticated = false;
    render(<PushBridge />);
    expect(m.getPushPermission).not.toHaveBeenCalled();
  });

  it('re-registers when the system reissues the token', async () => {
    render(<PushBridge />);
    await waitFor(() => expect(m.onPushTokenRefreshed).toHaveBeenCalled());
    refreshListener('new-token-value-0123456789');
    expect(m.register).toHaveBeenCalledWith('new-token-value-0123456789');
  });

  it('opens the transaction when a notification is tapped', () => {
    render(<PushBridge />);
    tapListener({ txId: 'tx-1' });
    expect(m.navigate).toHaveBeenCalledWith('/transaction/tx-1/flow');
  });

  it('does not navigate when the tap carries no usable id', () => {
    render(<PushBridge />);
    tapListener({ txId: '../x' });
    expect(m.navigate).not.toHaveBeenCalled();
  });
});
