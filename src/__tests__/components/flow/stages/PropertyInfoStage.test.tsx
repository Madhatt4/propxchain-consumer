// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The Property Information stage must show a form as done as soon as it is
 * saved on chain, before the stage itself is submitted. Marc filled the TA6
 * online, came back to the stage, and found it unticked (2026-09-18): the
 * canister hydration only ran for a completed stage or in edit mode.
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

function renderStage(): void {
  render(
    <MemoryRouter>
      <PropertyInfoStage stage={activeStage} transactionId="tx_1" tenure="freehold" />
    </MemoryRouter>,
  );
}

describe('PropertyInfoStage hydration', () => {
  beforeEach(() => {
    mockGetTA6.mockReset();
    mockGetTA10.mockReset();
    mockGetTA7.mockReset();
    mockGetTA7.mockResolvedValue(null);
  });

  it('should show a TA6 saved on chain as filled online on an active stage, before submission', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue(null);

    renderStage();

    await waitFor(() => expect(mockGetTA6).toHaveBeenCalledWith('tx_1'));
    expect(await screen.findByText(/Filled online/)).toBeInTheDocument();
    // TA10 is still owed, so the stage cannot be submitted yet.
    expect(screen.queryByText('Submit All Forms & Continue')).not.toBeInTheDocument();
  });

  it('should offer submission once every required form is saved on chain', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue({ rooms: [] });

    renderStage();

    expect(await screen.findByText('Submit All Forms & Continue')).toBeInTheDocument();
    expect(screen.getAllByText(/Filled online/)).toHaveLength(2);
  });

  it('should leave forms unticked when nothing is saved on chain', async () => {
    mockGetTA6.mockResolvedValue(null);
    mockGetTA10.mockResolvedValue(null);

    renderStage();

    await waitFor(() => expect(mockGetTA10).toHaveBeenCalled());
    expect(screen.queryByText(/Filled online/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Fill form online')).toHaveLength(2);
  });
});
