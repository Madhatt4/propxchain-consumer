// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const m = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  getPushPermission: vi.fn(),
  requestPushPermission: vi.fn(),
  register: vi.fn(),
  sendTestPush: vi.fn(),
}));

vi.mock('@/lib/native', () => ({ isNativeApp: m.isNativeApp }));
vi.mock('@/lib/pushNotifications', () => ({
  getPushPermission: m.getPushPermission,
  requestPushPermission: m.requestPushPermission,
}));
vi.mock('@/services/devicePushToken.service', () => ({ registerDevicePushToken: m.register }));
vi.mock('@/services/moveNarrator.service', () => ({ sendTestPush: m.sendTestPush }));

import TestPushCard from '../TestPushCard';

describe('TestPushCard', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.isNativeApp.mockReturnValue(false);
    m.getPushPermission.mockResolvedValue('granted');
    m.requestPushPermission.mockResolvedValue('granted');
    m.register.mockResolvedValue(true);
    m.sendTestPush.mockResolvedValue({ channel: 'push', status: 'sent', detail: '1 of 1 phones' });
  });

  it('sends from the website without touching phone registration', async () => {
    render(<TestPushCard />);
    fireEvent.click(screen.getByRole('button', { name: /send me a test notification/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/arrive on your phone/i);
    expect(m.register).not.toHaveBeenCalled();
  });

  it('refreshes this phone before sending in the app', async () => {
    m.isNativeApp.mockReturnValue(true);
    render(<TestPushCard />);
    fireEvent.click(await screen.findByRole('button', { name: /send me a test notification/i }));
    await screen.findByRole('status');
    expect(m.register).toHaveBeenCalled();
    expect(m.register.mock.invocationCallOrder[0]).toBeLessThan(m.sendTestPush.mock.invocationCallOrder[0]);
  });

  it('says plainly when no phone is signed up', async () => {
    m.sendTestPush.mockResolvedValue({ channel: 'push', status: 'skipped', detail: 'no registered phones' });
    render(<TestPushCard />);
    fireEvent.click(screen.getByRole('button', { name: /send me a test notification/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/no phone is signed up/i);
  });

  it('shows why a phone was turned down', async () => {
    m.sendTestPush.mockResolvedValue({
      channel: 'push',
      status: 'skipped',
      detail: 'registered phones were no longer valid (UNREGISTERED)',
    });
    render(<TestPushCard />);
    fireEvent.click(screen.getByRole('button', { name: /send me a test notification/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/turned down \(UNREGISTERED\)/i);
  });

  it('offers to turn notifications on in the app when not yet asked', async () => {
    m.isNativeApp.mockReturnValue(true);
    m.getPushPermission.mockResolvedValue('prompt');
    render(<TestPushCard />);
    fireEvent.click(await screen.findByRole('button', { name: /turn on notifications/i }));
    expect(await screen.findByRole('button', { name: /send me a test notification/i })).toBeInTheDocument();
    expect(m.register).toHaveBeenCalled();
  });

  it('points to phone settings when notifications were refused', async () => {
    m.isNativeApp.mockReturnValue(true);
    m.getPushPermission.mockResolvedValue('denied');
    render(<TestPushCard />);
    expect(await screen.findByText(/turn them on in your phone/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
