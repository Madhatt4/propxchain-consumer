// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ThemeToggleWithLabel } from '@/components/common/ThemeToggle';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface DashboardSidebarProps {
  activeRoute?: string;
  // userProfile prop kept for backwards compatibility with existing call sites,
  // but admin status now reads from the user_management `admins` stable map.
  userProfile?: any;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ activeRoute, userProfile }) => {
  const navigate = useNavigate();
  // Admin status is now sourced from the user_management `admins` stable map
  // (single source of truth, orthogonal to userType).
  const { isAdmin } = useIsAdmin();

  const menuItems = [
    {
      name: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      route: '/dashboard',
    },
    {
      name: 'Properties',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      route: '/dashboard/properties',
    },
    {
      name: 'Blockchain Ledger',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      route: '/dashboard/blockchain-ledger',
    },
    {
      name: 'Stakeholders',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      route: '/dashboard/stakeholders',
    },
    {
      name: 'Analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      route: '/dashboard/analytics',
    },
    ...(isAdmin ? [{
      name: 'Admin Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      route: '/admin',
    }, {
      // Admins can check the agent-facing portal without a separate login;
      // the portal itself still requires an agent-organisation membership.
      name: 'Estate Agent Portal',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      route: '/estate-agent',
    }] : []),
    {
      name: 'Support',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      route: '/dashboard/support',
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 min-h-screen border-r border-gray-200 dark:border-gray-700">
      <ScrollArea className="h-full">
        <div className="p-4">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = activeRoute === item.route;

              return (
                <Button
                  key={item.route}
                  onClick={() => navigate(item.route)}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 px-4 py-3 h-auto",
                    isActive && "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700",
                    !isActive && "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  {item.icon}
                  <span className="font-medium">{item.name}</span>
                </Button>
              );
            })}
          </nav>

          <Separator className="my-4 bg-gray-700" />

          {/* Theme Toggle */}
          <div className="px-2 mb-4">
            <ThemeToggleWithLabel className="w-full" />
          </div>

          <Separator className="my-4 bg-gray-700" />

          <div className="text-xs text-gray-500 px-2">
            <p>User: {userProfile?.name || 'Unknown'}</p>
            <p>Role: {userProfile?.userType || 'N/A'}</p>
            <p className="mt-1">Admin Status: {isAdmin ? '✅ Admin' : '❌ Not Admin'}</p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};

export default DashboardSidebar;
