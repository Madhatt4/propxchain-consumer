import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContractExchangeStage } from '../../../../components/transaction/flow/stages/ContractExchangeStage';
import type { StageConfig } from '../../../../types/stage.types';

const mockStage: StageConfig = {
  id: 'seller-6',
  order: 6,
  title: 'Contract & Exchange',
  description: 'E-signatures',
  status: 'active',
  journeyRole: 'seller',
  prerequisiteStageIds: ['seller-5'],
  hasProviderMarketplace: false,
  serviceMode: 'mock',
};

describe('ContractExchangeStage', () => {
  it('should render contract exchange header', () => {
    render(<ContractExchangeStage stage={mockStage} journeyRole="seller" />);
    expect(screen.getByText('Contract Exchange')).toBeInTheDocument();
  });

  it('should show dual-party status panel', () => {
    render(<ContractExchangeStage stage={mockStage} journeyRole="seller" />);
    expect(screen.getByText('Seller (You)')).toBeInTheDocument();
    expect(screen.getByText('Buyer')).toBeInTheDocument();
  });

  it('should show exchanged state when completed', () => {
    const completed = { ...mockStage, status: 'completed' as const };
    render(<ContractExchangeStage stage={completed} journeyRole="seller" />);
    expect(screen.getByText('Contracts Exchanged')).toBeInTheDocument();
  });
});
