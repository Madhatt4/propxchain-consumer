// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { useThemeClasses } from '../../hooks/useThemeClasses';

interface Stakeholder {
  name: string;
  role: string;
  lastActivity: string;
  avatar?: string;
}

interface StakeholdersPanelProps {
  stakeholders: Stakeholder[];
}

const StakeholdersPanel: React.FC<StakeholdersPanelProps> = ({ stakeholders }) => {
  const themeClasses = useThemeClasses();
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-gray-600', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
    return colors[index % colors.length];
  };

  return (
    <div className={`${themeClasses.cardBg} rounded-lg p-6`}>
      <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-4`}>Stakeholders</h3>
      <div className="space-y-4">
        {stakeholders.map((stakeholder, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className={`${getAvatarColor(index)} w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
              {getInitials(stakeholder.name)}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${themeClasses.textPrimary}`}>{stakeholder.name}</p>
              <p className={`text-xs ${themeClasses.textSecondary} capitalize`}>{stakeholder.role}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs ${themeClasses.textSecondary}`}>{stakeholder.lastActivity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StakeholdersPanel;
