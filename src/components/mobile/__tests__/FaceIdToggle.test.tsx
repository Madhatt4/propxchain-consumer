// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  isNativeApp: vi.fn(),
  canLockDevice: vi.fn(),
  isLockEnabled: vi.fn(),
  setLockEnabled: vi.fn(),
}));

vi.mock('@/lib/native', () => ({ isNativeApp: m.isNativeApp }));
vi.mock('@/lib/biometricLock', () => ({
  canLockDevice: m.canLockDevice,
  isLockEnabled: m.isLockEnabled,
  setLockEnabled: m.setLockEnabled,
}));

import FaceIdToggle from '../FaceIdToggle';

describe('FaceIdToggle', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.isNativeApp.mockReturnValue(true);
    m.canLockDevice.mockResolvedValue(true);
    m.isLockEnabled.mockResolvedValue(true);
    m.setLockEnabled.mockResolvedValue(undefined);
  });

  it('renders nothing outside the native app', () => {
    m.isNativeApp.mockReturnValue(false);
    const { container } = render(<FaceIdToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on a phone that cannot lock', async () => {
    m.canLockDevice.mockResolvedValue(false);
    const { container } = render(<FaceIdToggle />);
    await waitFor(() => expect(m.canLockDevice).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the lock as on and switches it off', async () => {
    render(<FaceIdToggle />);
    const sw = await screen.findByRole('switch', { name: /face id lock/i });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    await waitFor(() => expect(m.setLockEnabled).toHaveBeenCalledWith(false));
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });
});
