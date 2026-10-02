// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  canLockDevice: vi.fn(),
  isLockEnabled: vi.fn(),
  promptUnlock: vi.fn(),
  logout: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('@/lib/native', () => ({ isNativeApp: m.isNativeApp }));
vi.mock('@/lib/biometricLock', () => ({
  canLockDevice: m.canLockDevice,
  isLockEnabled: m.isLockEnabled,
  promptUnlock: m.promptUnlock,
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ logout: m.logout }) },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: m.addListener } }));

import BiometricGate, { RELOCK_AFTER_MS } from '../BiometricGate';

let stateListener: (s: { isActive: boolean }) => void = () => {};

describe('BiometricGate', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.isNativeApp.mockReturnValue(true);
    m.canLockDevice.mockResolvedValue(true);
    m.isLockEnabled.mockResolvedValue(true);
    m.promptUnlock.mockResolvedValue('cancelled');
    m.logout.mockResolvedValue(undefined);
    m.addListener.mockImplementation((_e: string, cb: typeof stateListener) => {
      stateListener = cb;
      return Promise.resolve({ remove: vi.fn() });
    });
  });
  afterEach(() => vi.useRealTimers());

  it('renders nothing outside the native app', () => {
    m.isNativeApp.mockReturnValue(false);
    const { container } = render(<BiometricGate />);
    expect(container).toBeEmptyDOMElement();
    expect(m.promptUnlock).not.toHaveBeenCalled();
  });

  it('locks on start and asks the phone straight away', async () => {
    render(<BiometricGate />);
    expect(await screen.findByTestId('biometric-gate')).toBeTruthy();
    await waitFor(() => expect(m.promptUnlock).toHaveBeenCalledTimes(1));
  });

  it('opens once the phone confirms the owner', async () => {
    m.promptUnlock.mockResolvedValue('unlocked');
    render(<BiometricGate />);
    await waitFor(() => expect(screen.queryByTestId('biometric-gate')).toBeNull());
  });

  it('shows a retry message when the person cancels', async () => {
    render(<BiometricGate />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('goes straight in when the phone cannot lock', async () => {
    m.canLockDevice.mockResolvedValue(false);
    render(<BiometricGate />);
    await waitFor(() => expect(screen.queryByTestId('biometric-gate')).toBeNull());
    expect(m.promptUnlock).not.toHaveBeenCalled();
  });

  it('goes straight in when the person switched the lock off', async () => {
    m.isLockEnabled.mockResolvedValue(false);
    render(<BiometricGate />);
    await waitFor(() => expect(screen.queryByTestId('biometric-gate')).toBeNull());
    expect(m.promptUnlock).not.toHaveBeenCalled();
  });

  it('signs out from the lock screen', async () => {
    render(<BiometricGate />);
    fireEvent.click(await screen.findByRole('button', { name: /sign out instead/i }));
    await waitFor(() => expect(m.logout).toHaveBeenCalled());
  });

  it('locks again only after a long enough time in the background', async () => {
    m.promptUnlock.mockResolvedValue('unlocked');
    render(<BiometricGate />);
    await waitFor(() => expect(m.promptUnlock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('biometric-gate')).toBeNull());

    // Short trip away: stays open.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T10:00:00Z'));
    act(() => stateListener({ isActive: false }));
    vi.setSystemTime(new Date('2026-10-02T10:00:10Z'));
    act(() => stateListener({ isActive: true }));
    vi.useRealTimers();
    expect(m.promptUnlock).toHaveBeenCalledTimes(1);

    // Long trip away: asks again.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T11:00:00Z'));
    act(() => stateListener({ isActive: false }));
    vi.setSystemTime(new Date(Date.parse('2026-10-02T11:00:00Z') + RELOCK_AFTER_MS + 1000));
    act(() => stateListener({ isActive: true }));
    vi.useRealTimers();
    await waitFor(() => expect(m.promptUnlock).toHaveBeenCalledTimes(2));
  });
});
