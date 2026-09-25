// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { AmountRangeFilterProps, AmountRangePreset } from '@/types/admin.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const AmountRangeFilter: React.FC<AmountRangeFilterProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  const presets: { value: AmountRangePreset; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'under-100k', label: 'Under £100k' },
    { value: '100k-500k', label: '£100k-£500k' },
    { value: '500k-1m', label: '£500k-£1M' },
    { value: 'over-1m', label: 'Over £1M' },
    { value: 'custom', label: 'Custom' },
  ];

  const handlePresetClick = (preset: AmountRangePreset) => {
    if (preset === 'custom') {
      // When switching to custom, preserve existing amounts if available
      onFilterChange({
        preset: 'custom',
        minAmount: activeFilter.minAmount,
        maxAmount: activeFilter.maxAmount,
      });
    } else {
      // Clear custom amounts when selecting a preset
      onFilterChange({
        preset,
        minAmount: undefined,
        maxAmount: undefined,
      });
    }
  };

  const handleMinAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onFilterChange({
      preset: 'custom',
      minAmount: value ? parseFloat(value) : undefined,
      maxAmount: activeFilter.maxAmount,
    });
  };

  const handleMaxAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onFilterChange({
      preset: 'custom',
      minAmount: activeFilter.minAmount,
      maxAmount: value ? parseFloat(value) : undefined,
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
            <Label htmlFor="min-amount" className="text-stone-600 dark:text-gray-300">
              Min Amount (£)
            </Label>
            <Input
              id="min-amount"
              type="number"
              min="0"
              step="1000"
              value={activeFilter.minAmount ?? ''}
              onChange={handleMinAmountChange}
              placeholder="0"
              className="border-stone-300 dark:border-gray-600 bg-stone-50 dark:bg-gray-800 text-stone-900 dark:text-gray-300 focus:border-stone-400 dark:focus:border-gray-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-amount" className="text-stone-600 dark:text-gray-300">
              Max Amount (£)
            </Label>
            <Input
              id="max-amount"
              type="number"
              min="0"
              step="1000"
              value={activeFilter.maxAmount ?? ''}
              onChange={handleMaxAmountChange}
              placeholder="No limit"
              className="border-stone-300 dark:border-gray-600 bg-stone-50 dark:bg-gray-800 text-stone-900 dark:text-gray-300 focus:border-stone-400 dark:focus:border-gray-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AmountRangeFilter;
