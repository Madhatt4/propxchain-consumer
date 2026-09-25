// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { TransactionStatusFilterProps } from '@/types/admin.types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TRANSACTION_STATUSES, TRANSACTION_STATUS_LABEL } from '@/types/transactionStatus';

const TransactionStatusFilter: React.FC<TransactionStatusFilterProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const filters: { value: keyof typeof counts; label: string }[] = [
    { value: 'all', label: 'All' },
    ...TRANSACTION_STATUSES.map((value) => ({ value, label: TRANSACTION_STATUS_LABEL[value] })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ value, label }) => (
        <Button
          key={value}
          variant={activeFilter === value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(value)}
          className={cn(
            "transition-colors",
            activeFilter === value
              ? "bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 dark:hover:bg-gray-600 text-stone-900 dark:text-white border-stone-300 dark:border-gray-600"
              : "bg-transparent border-stone-300 dark:border-gray-600 text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-white"
          )}
        >
          {label}
          <span className={cn(
            "ml-2 px-1.5 py-0.5 rounded text-xs",
            activeFilter === value
              ? "bg-stone-300/50 dark:bg-gray-600/50"
              : "bg-stone-200 dark:bg-gray-700"
          )}>
            {counts[value]}
          </span>
        </Button>
      ))}
    </div>
  );
};

export default TransactionStatusFilter;
