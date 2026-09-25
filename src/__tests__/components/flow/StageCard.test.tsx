import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StageCard } from '../../../components/transaction/flow/StageCard';
import type { StageConfig } from '../../../types/stage.types';

const baseStage: StageConfig = {
  id: 'seller-1', order: 1, title: 'List Property',
  description: 'Import listing', status: 'active',
  journeyRole: 'seller', prerequisiteStageIds: [],
  hasProviderMarketplace: false, serviceMode: 'mock',
};

describe('StageCard', () => {
  it('should render stage title and order', () => {
    render(<StageCard stage={baseStage} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText('List Property')).toBeInTheDocument();
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
  });

  it('should show ACTION NEEDED badge when active', () => {
    render(<StageCard stage={baseStage} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/action/i)).toBeInTheDocument();
  });

  it('should show lock icon and message when locked', () => {
    const locked = { ...baseStage, status: 'locked' as const };
    render(<StageCard stage={locked} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/locked/i)).toBeInTheDocument();
  });

  it('should show check icon when completed', () => {
    const completed = { ...baseStage, status: 'completed' as const };
    render(<StageCard stage={completed} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByTestId('stage-check-icon')).toBeInTheDocument();
  });

  it('should call onToggle when clicked (non-locked)', () => {
    const onToggle = vi.fn();
    render(<StageCard stage={baseStage} isExpanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('seller-1');
  });

  it('should NOT call onToggle when locked', () => {
    const onToggle = vi.fn();
    const locked = { ...baseStage, status: 'locked' as const };
    render(<StageCard stage={locked} isExpanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('should render children when expanded', () => {
    render(
      <StageCard stage={baseStage} isExpanded={true} onToggle={vi.fn()}>
        <div data-testid="stage-content">Content</div>
      </StageCard>
    );
    expect(screen.getByTestId('stage-content')).toBeInTheDocument();
  });
});
