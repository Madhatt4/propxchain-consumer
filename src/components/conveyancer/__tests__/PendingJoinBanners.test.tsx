// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PendingJoinBanners } from '../PendingJoinBanners';

const svc = vi.hoisted(() => ({
  readPendingJoinCode: vi.fn(),
  previewJoinCode: vi.fn(),
  redeemJoinCode: vi.fn(),
  clearPendingJoinCode: vi.fn(),
}));
vi.mock('@/services/conveyancerJoin.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/conveyancerJoin.service')>();
  return { joinOfferText: actual.joinOfferText, conveyancerJoinService: svc };
});
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { principalId: string; isAuthenticated: boolean }) => unknown) =>
    sel({ principalId: 'p1', isAuthenticated: true }),
}));

const PREVIEW = {
  firmName: 'Acme Law',
  firmCity: null,
  firmPostcode: null,
  clcId: 'C1',
  propertyAddress: '1 High Street',
  transactionType: 'purchase',
  expiresAt: '',
};

const renderAt = (url: string, onJoined?: () => void) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PendingJoinBanners onJoined={onJoined} />
    </MemoryRouter>,
  );

describe('PendingJoinBanners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.previewJoinCode.mockResolvedValue({ preview: PREVIEW });
  });

  it('should render nothing when there is no pending code', () => {
    svc.readPendingJoinCode.mockReturnValue(null);
    const { container } = renderAt('/dashboard');
    expect(container).toBeEmptyDOMElement();
    expect(svc.redeemJoinCode).not.toHaveBeenCalled();
  });

  it('should ask "Join <firm> on <property>?" and never redeem without the click', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    renderAt('/dashboard');
    expect(await screen.findByText('Join Acme Law on 1 High Street?')).toBeInTheDocument();
    expect(svc.redeemJoinCode).not.toHaveBeenCalled();
  });

  it('should redeem on the click, clear the code and show the welcome banner', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    svc.redeemJoinCode.mockResolvedValue({ success: true, firmName: 'Acme Law', clcId: 'C1' });
    const onJoined = vi.fn();
    renderAt('/dashboard', onJoined);
    fireEvent.click(await screen.findByRole('button', { name: 'Join' }));
    expect(await screen.findByText(/as Acme Law/)).toBeInTheDocument();
    expect(svc.redeemJoinCode).toHaveBeenCalledWith('CODE');
    expect(svc.clearPendingJoinCode).toHaveBeenCalled();
    expect(onJoined).toHaveBeenCalled();
  });

  it('should clear the code without redeeming when the firm declines', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    renderAt('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Don’t join' }));
    expect(svc.clearPendingJoinCode).toHaveBeenCalled();
    expect(svc.redeemJoinCode).not.toHaveBeenCalled();
    expect(screen.queryByText('Join Acme Law on 1 High Street?')).not.toBeInTheDocument();
  });

  it('should say so, and keep the code, when activation fails transiently', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    svc.redeemJoinCode.mockResolvedValue({ success: false, error: 'network', detail: 'offline' });
    renderAt('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(svc.clearPendingJoinCode).not.toHaveBeenCalled();
  });

  it('should drop a dead code found at preview without offering it', async () => {
    svc.readPendingJoinCode.mockReturnValue('CODE');
    svc.previewJoinCode.mockResolvedValue({ error: 'expired' });
    renderAt('/dashboard');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(svc.clearPendingJoinCode).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('should show the first-run banner on a ?joined= arrival', async () => {
    svc.readPendingJoinCode.mockReturnValue(null);
    renderAt('/dashboard?joined=tx1&firm=Acme%20Law&clc=C1');
    await waitFor(() => expect(screen.getByText(/as Acme Law/)).toBeInTheDocument());
  });
});
