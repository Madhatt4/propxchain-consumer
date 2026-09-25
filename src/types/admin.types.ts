// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Admin Dashboard Type Definitions
 * Defines types for admin dashboard filter components
 */

import { TransactionStatus } from './transaction.types';

/**
 * Transaction Status Filter Options
 * Includes 'all' option plus all available transaction statuses
 */
export type TransactionStatusFilterOption = 'all' | TransactionStatus;

/**
 * Date Range Filter Preset Options
 */
export type DateRangePreset = 'today' | 'this-week' | 'this-month' | 'this-year' | 'all-time' | 'custom';

/**
 * Date Range Filter Configuration
 */
export interface DateRangeFilter {
  preset: DateRangePreset;
  startDate?: string; // ISO date string for custom range
  endDate?: string;   // ISO date string for custom range
}

/**
 * Amount Range Filter Preset Options
 */
export type AmountRangePreset = 'under-100k' | '100k-500k' | '500k-1m' | 'over-1m' | 'all' | 'custom';

/**
 * Amount Range Filter Configuration
 */
export interface AmountRangeFilter {
  preset: AmountRangePreset;
  minAmount?: number; // Minimum amount in GBP for custom range
  maxAmount?: number; // Maximum amount in GBP for custom range
}

/**
 * Combined Filter State
 * Represents all active filters in the admin dashboard
 */
export interface TransactionFilters {
  status: TransactionStatusFilterOption;
  dateRange: DateRangeFilter;
  amountRange: AmountRangeFilter;
}

/**
 * Transaction Status Filter Props
 */
export interface TransactionStatusFilterProps {
  activeFilter: TransactionStatusFilterOption;
  onFilterChange: (filter: TransactionStatusFilterOption) => void;
  counts: Record<TransactionStatusFilterOption, number>;
}

/**
 * Date Range Filter Props
 */
export interface DateRangeFilterProps {
  activeFilter: DateRangeFilter;
  onFilterChange: (filter: DateRangeFilter) => void;
}

/**
 * Amount Range Filter Props
 */
export interface AmountRangeFilterProps {
  activeFilter: AmountRangeFilter;
  onFilterChange: (filter: AmountRangeFilter) => void;
}

/**
 * Combined Transaction Filters Props
 */
export interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  statusCounts: Record<TransactionStatusFilterOption, number>;
  onClearFilters: () => void;
}
