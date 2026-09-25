// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Where "Check my answers" is offered on the Property Information stage. It
 * reads the answers saved on chain, so it appears only for the seller, only
 * for the two forms the check can read, and only once there is something
 * saved to read. It must never gate the stage's own submit button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { PropertyInfoStage } from '../../../../components/transaction/flow/stages/PropertyInfoStage';
import type { StageConfig } from '../../../../types/stage.types';

const mockGetTA6 = vi.fn();
const mockGetTA10 = vi.fn();
const mockGetTA7 = vi.fn();
vi.mock('@/services/icp.service', () => ({
  icpService: {
    getTA6: (...a: unknown[]) => mockGetTA6(...a),
    getTA10: (...a: unknown[]) => mockGetTA10(...a),
    getTA7: (...a: unknown[]) => mockGetTA7(...a),
    recordFormUpload: vi.fn(),
    ledgerManager: { logEvent: vi.fn() },
  },
}));
vi.mock('@/services/web2-document.service', () => ({ web2DocumentService: { uploadDocument: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../../components/explainer/ExplainerModal', () => ({ default: () => null }));
vi.mock('../../../../components/explainer/ExplainerCard', () => ({ default: () => null }));

const activeStage: StageConfig = {
  id: 'seller-3',
  order: 3,
  title: 'Property Information',
  description: 'TA6, TA10, TA7',
  status: 'active',
  journeyRole: 'seller',
  prerequisiteStageIds: [],
  hasProviderMarketplace: false,
  serviceMode: 'real-read',
};

function renderStage(props: { viewerIsBuyer?: boolean; tenure?: 'freehold' | 'leasehold' } = {}): void {
  render(
    <MemoryRouter>
      <PropertyInfoStage
        stage={activeStage}
        transactionId="tx_1"
        tenure={props.tenure ?? 'freehold'}
        viewerIsBuyer={props.viewerIsBuyer ?? false}
      />
    </MemoryRouter>,
  );
}

describe('PropertyInfoStage — Check my answers', () => {
  beforeEach(() => {
    mockGetTA6.mockReset();
    mockGetTA10.mockReset();
    mockGetTA7.mockReset();
    mockGetTA7.mockResolvedValue(null);
  });

  it('should offer a check on each form the seller has saved on chain', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue({ rooms: [] });

    renderStage();

    expect(await screen.findAllByRole('button', { name: /Check my answers/ })).toHaveLength(2);
  });

  it('should offer no check on a form with nothing saved', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue(null);

    renderStage();

    expect(await screen.findAllByRole('button', { name: /Check my answers/ })).toHaveLength(1);
  });

  it('should offer no check on TA7, which the check cannot read', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue({ rooms: [] });
    mockGetTA7.mockResolvedValue({ leaseTerm: 99 });

    renderStage({ tenure: 'leasehold' });

    await waitFor(() => expect(mockGetTA7).toHaveBeenCalled());
    expect(await screen.findAllByRole('button', { name: /Check my answers/ })).toHaveLength(2);
  });

  it('should hide the check from a buyer browsing the seller journey', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue({ rooms: [] });

    renderStage({ viewerIsBuyer: true });

    await waitFor(() => expect(mockGetTA6).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Check my answers/ })).not.toBeInTheDocument();
  });

  it('should leave the submit button reachable regardless of the check', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue({ rooms: [] });

    renderStage();

    const submit = await screen.findByRole('button', { name: 'Submit All Forms & Continue' });
    expect(submit).toBeEnabled();
  });
});
