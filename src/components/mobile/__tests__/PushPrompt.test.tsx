// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  getPushPermission: vi.fn(),
  requestPushPermission: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/lib/native', () => ({ isNativeApp: m.isNativeApp }));
vi.mock('@/lib/pushNotifications', () => ({
  getPushPermission: m.getPushPermission,
  requestPushPermission: m.requestPushPermission,
}));
vi.mock('@/services/devicePushToken.service', () => ({ registerDevicePushToken: m.register }));

import PushPrompt from '../PushPrompt';

describe('PushPrompt', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.isNativeApp.mockReturnValue(true);
    m.getPushPermission.mockResolvedValue('prompt');
    m.requestPushPermission.mockResolvedValue('granted');
    m.register.mockResolvedValue(true);
  });

  it('renders nothing outside the native app', () => {
    m.isNativeApp.mockReturnValue(false);
    const { container } = render(<PushPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden once the person has already answered', async () => {
    m.getPushPermission.mockResolvedValue('granted');
    const { container } = render(<PushPrompt />);
    await waitFor(() => expect(m.getPushPermission).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('does not ask the system until the button is tapped', async () => {
    render(<PushPrompt />);
    await screen.findByRole('button', { name: /turn on notifications/i });
    expect(m.requestPushPermission).not.toHaveBeenCalled();
  });

  it('asks, registers the phone when allowed, then hides', async () => {
    const { container } = render(<PushPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: /turn on notifications/i }));
    await waitFor(() => expect(m.register).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('does not register when the person says no', async () => {
    m.requestPushPermission.mockResolvedValue('denied');
    render(<PushPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: /turn on notifications/i }));
    await waitFor(() => expect(m.requestPushPermission).toHaveBeenCalled());
    expect(m.register).not.toHaveBeenCalled();
  });

  it('promises no address or details in the notification', async () => {
    render(<PushPrompt />);
    expect(await screen.findByText(/never includes your address/i)).toBeTruthy();
  });
});
