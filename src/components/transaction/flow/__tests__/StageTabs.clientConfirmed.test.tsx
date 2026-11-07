import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StageTabs } from '../StageTabs';
import type { StageConfig } from '../../../../types/stage.types';

describe('StageTabs completion basis', () => {
  it('should badge a client-confirmed stage as such, and a verified one as Completed', () => {
    const stages = [
      { id: 'seller-3', order: 3, title: 'Property Info Forms', status: 'completed' } as StageConfig,
      { id: 'seller-5', order: 5, title: 'Conveyancer Review', status: 'completed', completionBasis: 'client-confirmed' } as StageConfig,
    ];
    render(<StageTabs stages={stages} activeStageId="seller-5" onSelect={() => undefined} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent('Completed');
    expect(tabs[1]).toHaveTextContent('Client-confirmed');
    expect(tabs[1]).not.toHaveTextContent('Completed');
  });
});
