// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useThemeClasses } from '../../hooks/useThemeClasses';

interface DashboardKPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const DashboardKPICard: React.FC<DashboardKPICardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'blue'
}) => {
  const themeClasses = useThemeClasses();
  const colorClasses = {
    blue: 'bg-gray-600',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-3 sm:p-6`}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`${colorClasses[color]} p-2 sm:p-3 rounded-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`text-xs sm:text-sm font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
      <h3 className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1`}>{title}</h3>
      <div className={`text-2xl sm:text-3xl font-bold ${themeClasses.textPrimary}`}>{value}</div>
    </div>
  );
};

export default DashboardKPICard;
