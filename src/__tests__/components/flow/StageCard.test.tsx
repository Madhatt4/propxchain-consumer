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

  describe('reopening a completed stage', () => {
    const completed = { ...baseStage, status: 'completed' as const };

    it('should offer "Review or update" on a completed stage that supports editing', () => {
      const onEditClick = vi.fn();
      const onToggle = vi.fn();
      render(
        <StageCard stage={completed} isExpanded={true} onToggle={onToggle} onEditClick={onEditClick}>
          <div>Summary</div>
        </StageCard>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Review or update' }));
      expect(onEditClick).toHaveBeenCalledWith('seller-1');
      // A separate button from the header toggle, so the card does not collapse.
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should not offer "Review or update" when the stage has no edit handler', () => {
      render(
        <StageCard stage={completed} isExpanded={true} onToggle={vi.fn()}>
          <div>Summary</div>
        </StageCard>,
      );
      expect(screen.queryByRole('button', { name: 'Review or update' })).not.toBeInTheDocument();
    });

    it('should not offer "Review or update" on a stage that is not completed', () => {
      render(
        <StageCard stage={baseStage} isExpanded={true} onToggle={vi.fn()} onEditClick={vi.fn()}>
          <div>Form</div>
        </StageCard>,
      );
      expect(screen.queryByRole('button', { name: 'Review or update' })).not.toBeInTheDocument();
    });

    it('should offer Close in edit mode and return to the summary through onCloseEdit', () => {
      const onCloseEdit = vi.fn();
      render(
        <StageCard stage={completed} isExpanded={true} onToggle={vi.fn()} isEditing onEditClick={vi.fn()} onCloseEdit={onCloseEdit}>
          <div>Form</div>
        </StageCard>,
      );
      expect(screen.queryByRole('button', { name: 'Review or update' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onCloseEdit).toHaveBeenCalledWith('seller-1');
    });
  });
});
