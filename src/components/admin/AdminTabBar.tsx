// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ADMIN_TAB_GROUPS,
  type AdminTabGroup,
  type DashboardTab,
} from '../../types/adminDashboard.types';

// Human-readable label per sub-tab. Title case to match the previous flat bar.
const TAB_LABELS: Record<DashboardTab, string> = {
  transactions: 'Transactions',
  properties: 'Properties',
  documents: 'Documents',
  'land-registry': 'Land Registry',
  budget: 'Budget',
  conveyancers: 'Conveyancers',
  users: 'Users',
  messages: 'Messages',
  emails: 'Emails',
  canisters: 'Canisters',
};

const GROUP_ORDER: AdminTabGroup[] = ['operations', 'people', 'platform'];

interface AdminTabBarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  unprocessedEmailCount: number;
}

// Derive which group owns the currently active tab so the top row and the
// sub-tab row stay in sync without separate group state.
function groupForTab(tab: DashboardTab): AdminTabGroup {
  const match = GROUP_ORDER.find((g) => ADMIN_TAB_GROUPS[g].tabs.includes(tab));
  return match ?? 'operations';
}

/**
 * Two-level grouped navigation for the admin dashboard. The top row is a
 * segmented group control; the second row shows only the active group's
 * sub-tabs. Clicking a group jumps to that group's first tab.
 */
export const AdminTabBar: React.FC<AdminTabBarProps> = ({
  activeTab,
  onTabChange,
  unprocessedEmailCount,
}) => {
  const activeGroup = groupForTab(activeTab);
  const subTabs = ADMIN_TAB_GROUPS[activeGroup].tabs;

  return (
    <div className="mb-4 space-y-2">
      {/* Top row: group segmented control */}
      <div className="inline-flex rounded-md border p-0.5">
        {GROUP_ORDER.map((group) => {
          const isActive = group === activeGroup;
          return (
            <Button
              key={group}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              data-active={isActive}
              onClick={() => onTabChange(ADMIN_TAB_GROUPS[group].tabs[0])}
            >
              {ADMIN_TAB_GROUPS[group].label}
            </Button>
          );
        })}
      </div>

      {/* Second row: sub-tabs for the active group only */}
      <TabsList>
        {subTabs.map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            onClick={() => onTabChange(tab)}
            className={cn(tab === 'emails' && 'gap-1')}
          >
            {TAB_LABELS[tab]}
            {tab === 'emails' && unprocessedEmailCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-xs">
                {unprocessedEmailCount}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
};
