// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authUtils } from '../../utils/auth';
import NotificationBell from '../common/NotificationBell';
import RateLimitIndicator from '../common/RateLimitIndicator';

// shadcn-ui components
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from '@/components/brand/Logo';

interface DashboardHeaderProps {
  user: any;
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backRoute?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  title = 'PropXchain',
  subtitle,
  showBackButton = false,
  backRoute = '/dashboard',
}) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authUtils.logout();
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <header className="bg-white shadow-lg border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(backRoute)}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                aria-label="Go back"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Button>
            )}
            <div>
              {title === 'PropXchain' ? (
                <Logo variant="mark" tone="onLight" to="/" className="h-11 w-auto" />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
              )}
              {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <NotificationBell />

            {/* Rate Limit Indicator */}
            <RateLimitIndicator />

            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 bg-gray-200 dark:bg-gray-600">
                <AvatarFallback className="bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-white text-sm">
                  {getInitials(user?.firstName, user?.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            {/* size="sm" renders 36px; this header is on every dashboard page,
                so it takes the 44px floor (measured in production 2026-07-31). */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="min-h-11 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
