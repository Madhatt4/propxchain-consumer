// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PendingJoinBanners } from '../PendingJoinBanners';

const svc = vi.hoisted(() => ({
  readPendingJoinCode: vi.fn(),
  redeemJoinCode: vi.fn(),
  clearPendingJoinCode: vi.fn(),
}));
vi.mock('@/services/conveyancerJoin.service', () => ({ conveyancerJoinService: svc }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { principalId: string; isAuthenticated: boolean }) => unknown) =>
    sel({ principalId: 'p1', isAuthenticated: true }),
}));

const renderAt = (url: string, onJoined?: () => void) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PendingJoinBanners onJoined={onJoined} />
    </MemoryRouter>,
  );

describe('PendingJoinBanners', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render nothing when there is no pending code', () => {
    svc.readPendingJoinCode.mockReturnValue(null);
    const { container } = renderAt('/dashboard');
    expect(container).toBeEmptyDOMElement();
    expect(svc.redeemJoinCode).not.toHaveBeenCalled();
  });

  it('should redeem a pending code, clear it and show the welcome banner', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    svc.redeemJoinCode.mockResolvedValue({ success: true, firmName: 'Acme Law', clcId: 'C1' });
    const onJoined = vi.fn();
    renderAt('/dashboard', onJoined);
    expect(await screen.findByText(/as Acme Law/)).toBeInTheDocument();
    expect(svc.clearPendingJoinCode).toHaveBeenCalled();
    expect(onJoined).toHaveBeenCalled();
  });

  it('should say so, and keep the code, when activation fails transiently', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    svc.redeemJoinCode.mockResolvedValue({ success: false, error: 'network', detail: 'offline' });
    renderAt('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(svc.clearPendingJoinCode).not.toHaveBeenCalled();
  });

  it('should show the first-run banner on a ?joined= arrival', async () => {
    svc.readPendingJoinCode.mockReturnValue(null);
    renderAt('/dashboard?joined=tx1&firm=Acme%20Law&clc=C1');
    await waitFor(() => expect(screen.getByText(/as Acme Law/)).toBeInTheDocument());
  });
});
