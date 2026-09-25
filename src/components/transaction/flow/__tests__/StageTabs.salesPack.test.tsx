// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Stage 0 · Sales pack — the pack leads the stage row, before List Property
 * (amended decision on Madhatt4/Propxchain#115). The pseudo tab mirrors the
 * seller view's "Buyer side" slot: no real stage machinery behind it.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { StageTabs, SALES_PACK_TAB_ID } from '../StageTabs';
import type { StageConfig } from '../../../../types/stage.types';

const stages: StageConfig[] = [
  { id: 'seller-1', order: 1, title: 'List Property', status: 'active' } as StageConfig,
  { id: 'seller-2', order: 2, title: 'Property Searches', status: 'locked' } as StageConfig,
];

describe('StageTabs sales pack pseudo tab', () => {
  it('should lead the row as Stage 0 with the readiness badge when a summary is given', () => {
    render(
      <StageTabs
        stages={stages}
        salesPackSummary="6 of 9"
        activeStageId="seller-1"
        onSelect={() => undefined}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent('Stage 0');
    expect(tabs[0]).toHaveTextContent('Sales pack');
    expect(tabs[0]).toHaveTextContent('6 of 9');
    expect(tabs[1]).toHaveTextContent('List Property');
  });

  it('should select the pseudo tab id on click', () => {
    const onSelect = vi.fn();
    render(
      <StageTabs
        stages={stages}
        salesPackSummary="Complete"
        activeStageId="seller-1"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getAllByRole('tab')[0]);
    expect(onSelect).toHaveBeenCalledWith(SALES_PACK_TAB_ID);
  });

  it('should render no Stage 0 tab without a summary', () => {
    render(
      <StageTabs stages={stages} activeStageId="seller-1" onSelect={() => undefined} />,
    );
    expect(screen.queryByText('Sales pack')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });
});
