import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StageTabs } from '../StageTabs';
import type { StageConfig, StageStatus } from '../../../../types/stage.types';

function stagesWith(status: StageStatus): StageConfig[] {
  return [
    { id: 'seller-1', order: 1, title: 'List Property', status: 'completed' } as StageConfig,
    { id: 'seller-2', order: 2, title: 'Conveyancer Quotes', status } as StageConfig,
  ];
}

function renderTabs(stages: StageConfig[]): ReturnType<typeof render> {
  return render(<StageTabs stages={stages} activeStageId="seller-2" onSelect={() => undefined} />);
}

function justCompletedTabs(): HTMLElement[] {
  return screen.getAllByRole('tab').filter((tab) => tab.querySelector('[data-just-completed]'));
}

describe('StageTabs just-completed motion', () => {
  it('should not animate stages that were already completed on first render', () => {
    renderTabs(stagesWith('completed'));

    expect(justCompletedTabs()).toHaveLength(0);
  });

  it('should animate only the stage that moves from active to completed', () => {
    const { rerender } = renderTabs(stagesWith('active'));

    rerender(<StageTabs stages={stagesWith('completed')} activeStageId="seller-2" onSelect={() => undefined} />);

    const animated = justCompletedTabs();
    expect(animated).toHaveLength(1);
    expect(animated[0]).toHaveTextContent('Conveyancer Quotes');
  });

  it('should stop marking the stage once a later render sees it already completed', () => {
    const { rerender } = renderTabs(stagesWith('active'));
    rerender(<StageTabs stages={stagesWith('completed')} activeStageId="seller-2" onSelect={() => undefined} />);

    rerender(<StageTabs stages={stagesWith('completed')} activeStageId="seller-1" onSelect={() => undefined} />);

    expect(justCompletedTabs()).toHaveLength(0);
  });
});
