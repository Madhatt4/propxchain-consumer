// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// Property Search Types for UK Property Conveyancing

export type SearchCategory = 'essential' | 'location-specific' | 'optional';

/**
 * Search Type Definition
 * Represents metadata about a type of property search
 */
export interface SearchType {
  id: string;
  name: string;
  category: SearchCategory;
  description: string;
  typicalTurnaround: string;
  validityPeriod: number; // Days the search is valid for
  estimatedCost?: string;
  applicableRegions?: string[]; // For location-specific searches
  icon?: string; // Icon identifier
}
