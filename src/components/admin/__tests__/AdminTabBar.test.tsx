// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '@/components/ui/tabs';
import type { DashboardTab } from '../../../types/adminDashboard.types';
import { AdminTabBar } from '../AdminTabBar';

// AdminTabBar renders TabsTrigger primitives, which require a Tabs root context.
function renderBar(activeTab: DashboardTab, onTabChange: (t: DashboardTab) => void) {
  return render(
    <Tabs value={activeTab}>
      <AdminTabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        unprocessedEmailCount={0}
      />
    </Tabs>,
  );
}

describe('AdminTabBar', () => {
  it('renders the active tab under its correct group', () => {
    renderBar('canisters', vi.fn());

    const platformGroup = screen.getByRole('button', { name: 'Platform' });
    expect(platformGroup).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('tab', { name: 'Canisters' })).toBeInTheDocument();
  });

  it('fires onTabChange when a sub-tab in the active group is clicked', () => {
    const onTabChange = vi.fn();
    renderBar('transactions', onTabChange);

    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(onTabChange).toHaveBeenCalledWith('documents');
  });

  it('switches group and selects its first tab when a group is clicked', () => {
    const onTabChange = vi.fn();
    renderBar('transactions', onTabChange);

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }));
    expect(onTabChange).toHaveBeenCalledWith('canisters');
  });
});
