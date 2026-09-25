// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { TransactionFiltersProps } from '@/types/admin.types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TransactionStatusFilter from './TransactionStatusFilter';
import DateRangeFilter from './DateRangeFilter';
import AmountRangeFilter from './AmountRangeFilter';

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  onFiltersChange,
  statusCounts,
  onClearFilters,
}) => {
  const handleStatusChange = (status: typeof filters.status) => {
    onFiltersChange({
      ...filters,
      status,
    });
  };

  const handleDateRangeChange = (dateRange: typeof filters.dateRange) => {
    onFiltersChange({
      ...filters,
      dateRange,
    });
  };

  const handleAmountRangeChange = (amountRange: typeof filters.amountRange) => {
    onFiltersChange({
      ...filters,
      amountRange,
    });
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-gray-200">Filters</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="border-stone-300 dark:border-gray-600 text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-white"
          >
            Clear Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-stone-600 dark:text-gray-300 mb-3">Status</h4>
          <TransactionStatusFilter
            activeFilter={filters.status}
            onFilterChange={handleStatusChange}
            counts={statusCounts}
          />
        </div>

        <div>
          <h4 className="text-sm font-medium text-stone-600 dark:text-gray-300 mb-3">Date Range</h4>
          <DateRangeFilter
            activeFilter={filters.dateRange}
            onFilterChange={handleDateRangeChange}
          />
        </div>

        <div>
          <h4 className="text-sm font-medium text-stone-600 dark:text-gray-300 mb-3">Amount Range</h4>
          <AmountRangeFilter
            activeFilter={filters.amountRange}
            onFilterChange={handleAmountRangeChange}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionFilters;
