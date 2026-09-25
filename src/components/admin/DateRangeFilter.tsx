// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { DateRangeFilterProps, DateRangePreset } from '@/types/admin.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  const presets: { value: DateRangePreset; label: string }[] = [
    { value: 'all-time', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'this-week', label: 'This Week' },
    { value: 'this-month', label: 'This Month' },
    { value: 'this-year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ];

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      // When switching to custom, preserve existing dates if available
      onFilterChange({
        preset: 'custom',
        startDate: activeFilter.startDate,
        endDate: activeFilter.endDate,
      });
    } else {
      // Clear custom dates when selecting a preset
      onFilterChange({
        preset,
        startDate: undefined,
        endDate: undefined,
      });
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      preset: 'custom',
      startDate: e.target.value,
      endDate: activeFilter.endDate,
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      preset: 'custom',
      startDate: activeFilter.startDate,
      endDate: e.target.value,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map(({ value, label }) => (
          <Button
            key={value}
            variant={activeFilter.preset === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(value)}
            className={cn(
              "transition-colors",
              activeFilter.preset === value
                ? "bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-stone-900 dark:text-white border-stone-300 dark:border-gray-600"
                : "bg-transparent border-stone-300 dark:border-gray-600 text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-white"
            )}
          >
            {label}
          </Button>
        ))}
      </div>

      {activeFilter.preset === 'custom' && (
        <div className="flex flex-wrap gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start-date" className="text-stone-600 dark:text-gray-300">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={activeFilter.startDate || ''}
              onChange={handleStartDateChange}
              className="border-stone-300 dark:border-gray-600 bg-stone-50 dark:bg-gray-800 text-stone-900 dark:text-gray-300 focus:border-stone-400 dark:focus:border-gray-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end-date" className="text-stone-600 dark:text-gray-300">
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={activeFilter.endDate || ''}
              onChange={handleEndDateChange}
              className="border-stone-300 dark:border-gray-600 bg-stone-50 dark:bg-gray-800 text-stone-900 dark:text-gray-300 focus:border-stone-400 dark:focus:border-gray-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
