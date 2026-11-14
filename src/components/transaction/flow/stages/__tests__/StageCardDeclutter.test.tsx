import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReviewSellerPackStage } from '../ReviewSellerPackStage';
import { PropertyMatchedStage } from '../PropertyMatchedStage';
import { MortgageFundingStage } from '../MortgageFundingStage';
import type { StageConfig } from '../../../../../types/stage.types';

vi.mock('@/services/buyerPack.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/buyerPack.service')>('@/services/buyerPack.service');
  return {
    ...actual,
    loadBuyerPack: vi.fn().mockResolvedValue([]),
    declareBuyerPack: vi.fn(),
    syncBuyerPack: vi.fn(),
    readOfferExpiry: vi.fn(),
  };
});
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/services/lenderPanel.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/lenderPanel.service')>();
  return {
    ...actual,
    lenderPanelService: {
      getLenders: vi.fn().mockResolvedValue([]),
      getPanelConveyancerIds: vi.fn().mockResolvedValue([]),
      clearCache: vi.fn(),
    },
  };
});

function makeStage(status: StageConfig['status']): StageConfig {
  return {
    id: 's-1', order: 1, title: 'Stage', description: '', journeyRole: 'buyer',
    prerequisiteStageIds: [], hasProviderMarketplace: false, serviceMode: 'mock', status,
  } as StageConfig;
}

describe('stage card declutter', () => {
  it('shows a plain muted waiting line, not an alert, while the seller pack is not ready', () => {
    const { container } = render(<ReviewSellerPackStage stage={makeStage('watching')} />);
    expect(screen.getByText('Waiting on the seller.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="amber"]')).toBeNull();
  });

  it('drops the matched and instruction banners from the property matched stage but keeps the action', () => {
    render(<PropertyMatchedStage stage={makeStage('active')} />);
    expect(screen.queryByText(/Offer accepted/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirm the agreed price and/)).not.toBeInTheDocument();
    expect(screen.getByText('Confirm agreed price')).toBeInTheDocument();
  });

  it('renders nothing for a completed property matched stage', () => {
    const { container } = render(<PropertyMatchedStage stage={makeStage('completed')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no edit-mode banner on the funding stage in edit mode', async () => {
    render(
      <MemoryRouter>
        <MortgageFundingStage stage={makeStage('active')} transactionId="tx_1" isEditing />
      </MemoryRouter>,
    );
    expect(await screen.findByText('How are you funding this purchase?')).toBeInTheDocument();
    expect(screen.queryByText(/Editing your funding details/)).not.toBeInTheDocument();
  });
});
