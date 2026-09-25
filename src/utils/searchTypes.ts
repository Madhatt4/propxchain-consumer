// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { SearchType, SearchCategory } from '../types/searches';

/**
 * Comprehensive list of UK Property Search Types
 * Used for property conveyancing transactions
 */
export const SEARCH_TYPES: SearchType[] = [
  // ═══════════════════════════════════════════════════════════════
  // ESSENTIAL SEARCHES
  // These are typically required for all property transactions
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'local-authority-search',
    name: 'Local Authority Search (LLC1 + CON29)',
    category: 'essential',
    description: 'Combined search covering local land charges, planning permissions, building control, roads, and public paths. Essential for understanding local authority records affecting the property.',
    typicalTurnaround: '2-10 working days',
    validityPeriod: 180, // 6 months
    estimatedCost: '£100-£300',
    icon: 'building-office',
  },
  {
    id: 'drainage-water-search',
    name: 'Drainage and Water Search',
    category: 'essential',
    description: 'Confirms water supply, sewerage connections, and drainage arrangements. Identifies if property is connected to public sewers or has private drainage.',
    typicalTurnaround: '2-5 working days',
    validityPeriod: 180, // 6 months
    estimatedCost: '£40-£80',
    icon: 'water-drop',
  },
  {
    id: 'environmental-search',
    name: 'Environmental Search',
    category: 'essential',
    description: 'Checks for contaminated land, landfill sites, radon gas, flooding risks, and other environmental hazards that may affect the property.',
    typicalTurnaround: '1-3 working days',
    validityPeriod: 180, // 6 months
    estimatedCost: '£50-£100',
    icon: 'leaf',
  },
  {
    id: 'land-registry-title',
    name: 'Land Registry Title Search',
    category: 'essential',
    description: 'Official title register and plan from HM Land Registry showing ownership, boundaries, rights, and any charges or restrictions on the property.',
    typicalTurnaround: 'Instant-24 hours',
    validityPeriod: 90, // 3 months
    estimatedCost: '£3-£7',
    icon: 'document-text',
  },

  // ═══════════════════════════════════════════════════════════════
  // LOCATION-SPECIFIC SEARCHES
  // Required based on property location or characteristics
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'chancel-repair',
    name: 'Chancel Repair Liability Search',
    category: 'location-specific',
    description: 'Identifies if the property may be liable for chancel repair contributions to the local church. Important for properties near historic churches.',
    typicalTurnaround: '1-2 working days',
    validityPeriod: 180,
    estimatedCost: '£20-£40',
    icon: 'church',
  },
  {
    id: 'coal-mining-con29m',
    name: 'Coal Mining Search (CON29M)',
    category: 'location-specific',
    description: 'Essential for properties in former coal mining areas. Checks for mine shafts, tunnels, subsidence claims, and mine gas emissions.',
    typicalTurnaround: '2-5 working days',
    validityPeriod: 180,
    estimatedCost: '£30-£50',
    applicableRegions: ['Yorkshire', 'Midlands', 'Wales', 'North East', 'North West', 'East Midlands'],
    icon: 'mining',
  },
  {
    id: 'tin-mining',
    name: 'Tin Mining Search',
    category: 'location-specific',
    description: 'Checks for historical tin mining activity which could affect ground stability. Required in Cornwall and parts of Devon.',
    typicalTurnaround: '2-5 working days',
    validityPeriod: 180,
    estimatedCost: '£30-£50',
    applicableRegions: ['Cornwall', 'Devon'],
    icon: 'mining',
  },
  {
    id: 'clay-mining',
    name: 'Clay Mining Search',
    category: 'location-specific',
    description: 'Identifies clay extraction sites that may cause subsidence. Required in areas with historical brick-making or pottery industries.',
    typicalTurnaround: '2-5 working days',
    validityPeriod: 180,
    estimatedCost: '£30-£50',
    applicableRegions: ['Stoke-on-Trent', 'Staffordshire', 'Bedfordshire'],
    icon: 'mining',
  },
  {
    id: 'brine-subsidence',
    name: 'Brine Subsidence Search',
    category: 'location-specific',
    description: 'Checks for salt extraction (brine pumping) which can cause significant ground movement and subsidence.',
    typicalTurnaround: '2-5 working days',
    validityPeriod: 180,
    estimatedCost: '£30-£50',
    applicableRegions: ['Cheshire', 'Worcestershire'],
    icon: 'mining',
  },
  {
    id: 'limestone-mining',
    name: 'Limestone Mining Search',
    category: 'location-specific',
    description: 'Identifies limestone quarrying and mining that may affect ground stability in areas with historical quarrying.',
    typicalTurnaround: '2-5 working days',
    validityPeriod: 180,
    estimatedCost: '£30-£50',
    applicableRegions: ['Derbyshire', 'Yorkshire', 'Somerset', 'Gloucestershire'],
    icon: 'mining',
  },

  // ═══════════════════════════════════════════════════════════════
  // OPTIONAL / ADDITIONAL SEARCHES
  // May be recommended based on specific circumstances
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'flood-risk',
    name: 'Flood Risk Search',
    category: 'optional',
    description: 'Detailed flood risk assessment including river, coastal, surface water, and groundwater flood risks. More comprehensive than basic environmental search.',
    typicalTurnaround: '1-2 working days',
    validityPeriod: 180,
    estimatedCost: '£20-£40',
    icon: 'flood',
  },
  {
    id: 'hs2-search',
    name: 'HS2 Search',
    category: 'optional',
    description: 'Checks proximity to the High Speed 2 rail project including safeguarded land, construction areas, and potential compensation schemes.',
    typicalTurnaround: '1-3 working days',
    validityPeriod: 180,
    estimatedCost: '£20-£40',
    applicableRegions: ['London', 'West Midlands', 'East Midlands', 'Yorkshire'],
    icon: 'train',
  },
  {
    id: 'crossrail-search',
    name: 'Crossrail Search',
    category: 'optional',
    description: 'Identifies properties affected by the Elizabeth Line (Crossrail) project including tunnels, station areas, and associated works.',
    typicalTurnaround: '1-3 working days',
    validityPeriod: 180,
    estimatedCost: '£20-£40',
    applicableRegions: ['London', 'Berkshire', 'Essex'],
    icon: 'train',
  },
  {
    id: 'commons-registration',
    name: 'Commons Registration Search',
    category: 'optional',
    description: 'Checks if land is registered as common land or town/village green. Important for rural properties or those near green spaces.',
    typicalTurnaround: '5-10 working days',
    validityPeriod: 180,
    estimatedCost: '£20-£50',
    icon: 'trees',
  },
  {
    id: 'land-charges-k15-k16',
    name: 'Land Charges Search (K15/K16)',
    category: 'optional',
    description: 'Searches the Land Charges Register for unregistered land. Required for properties not registered with HM Land Registry.',
    typicalTurnaround: '1-2 working days',
    validityPeriod: 90,
    estimatedCost: '£2-£5',
    icon: 'document-search',
  },
  {
    id: 'index-map-sim',
    name: 'Index Map Search (SIM)',
    category: 'optional',
    description: 'Identifies all registered titles affecting a particular area of land. Useful for development sites or complex ownership situations.',
    typicalTurnaround: '1-2 working days',
    validityPeriod: 90,
    estimatedCost: '£4-£8',
    icon: 'map',
  },
  {
    id: 'highways-search',
    name: 'Highways Search',
    category: 'optional',
    description: 'Detailed information about roads, footpaths, and planned highway schemes affecting or adjacent to the property.',
    typicalTurnaround: '5-15 working days',
    validityPeriod: 180,
    estimatedCost: '£20-£80',
    icon: 'road',
  },
  {
    id: 'planning-search',
    name: 'Detailed Planning Search',
    category: 'optional',
    description: 'In-depth search of planning history, applications, and decisions for the property and surrounding area beyond standard CON29.',
    typicalTurnaround: '5-15 working days',
    validityPeriod: 180,
    estimatedCost: '£50-£150',
    icon: 'building-plan',
  },
];

/**
 * Get all search types
 */
export const getAllSearchTypes = (): SearchType[] => {
  return SEARCH_TYPES;
};

/**
 * Get search types by category
 */
export const getSearchTypesByCategory = (category: SearchCategory): SearchType[] => {
  return SEARCH_TYPES.filter(st => st.category === category);
};

/**
 * Get essential search types
 */
export const getEssentialSearchTypes = (): SearchType[] => {
  return getSearchTypesByCategory('essential');
};

/**
 * Get location-specific search types
 */
export const getLocationSpecificSearchTypes = (): SearchType[] => {
  return getSearchTypesByCategory('location-specific');
};

/**
 * Get optional search types
 */
export const getOptionalSearchTypes = (): SearchType[] => {
  return getSearchTypesByCategory('optional');
};

/**
 * Get a search type by ID
 */
export const getSearchTypeById = (id: string): SearchType | undefined => {
  return SEARCH_TYPES.find(st => st.id === id);
};

/**
 * Get search types applicable to a specific region
 */
export const getSearchTypesForRegion = (region: string): SearchType[] => {
  return SEARCH_TYPES.filter(st => {
    // Include if no region restriction, or if region matches
    if (!st.applicableRegions) return true;
    return st.applicableRegions.some(r =>
      r.toLowerCase() === region.toLowerCase() ||
      region.toLowerCase().includes(r.toLowerCase())
    );
  });
};

/**
 * Calculate expiry date from search date and validity period
 */
export const calculateExpiryDate = (searchDate: string, searchTypeId: string): string | null => {
  const searchType = getSearchTypeById(searchTypeId);
  if (!searchType) return null;

  const date = new Date(searchDate);
  date.setDate(date.getDate() + searchType.validityPeriod);
  return date.toISOString();
};

/**
 * Check if a search is expired
 */
export const isSearchExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) < new Date();
};

/**
 * Check if a search is expiring soon (within 30 days)
 */
export const isSearchExpiringSoon = (expiresAt: string, thresholdDays: number = 30): boolean => {
  const expiryDate = new Date(expiresAt);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);
  return expiryDate <= thresholdDate && expiryDate > new Date();
};

/**
 * Get days until expiry
 */
export const getDaysUntilExpiry = (expiresAt: string): number => {
  const expiryDate = new Date(expiresAt);
  const today = new Date();
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Get category display name
 */
export const getCategoryDisplayName = (category: SearchCategory): string => {
  switch (category) {
    case 'essential':
      return 'Essential Searches';
    case 'location-specific':
      return 'Location-Specific Searches';
    case 'optional':
      return 'Optional Searches';
    default:
      return 'Searches';
  }
};

/**
 * Get category description
 */
export const getCategoryDescription = (category: SearchCategory): string => {
  switch (category) {
    case 'essential':
      return 'Typically required for all property transactions';
    case 'location-specific':
      return 'May be required based on property location';
    case 'optional':
      return 'Recommended based on specific circumstances';
    default:
      return '';
  }
};

/**
 * Get location-specific searches that might apply based on postcode data
 * This is a lightweight check using region names without API call
 */
export const getLocationSpecificSearchesForArea = (
  adminDistrict: string | null,
  adminCounty: string | null,
  region: string | null
): SearchType[] => {
  const locationSpecific = getLocationSpecificSearchTypes();
  const matched: SearchType[] = [];

  for (const searchType of locationSpecific) {
    if (!searchType.applicableRegions) continue;

    const areas = [adminDistrict, adminCounty, region].filter(Boolean) as string[];

    for (const area of areas) {
      const areaLower = area.toLowerCase();
      const isMatch = searchType.applicableRegions.some(
        region => areaLower.includes(region.toLowerCase()) ||
                  region.toLowerCase().includes(areaLower)
      );
      if (isMatch) {
        matched.push(searchType);
        break;
      }
    }
  }

  return matched;
};

/**
 * Get all searches recommended for a specific area
 * Returns essential + location-specific matches
 */
export const getAllRecommendedSearchesForArea = (
  adminDistrict: string | null,
  adminCounty: string | null,
  region: string | null
): SearchType[] => {
  const essential = getEssentialSearchTypes();
  const locationSpecific = getLocationSpecificSearchesForArea(adminDistrict, adminCounty, region);

  // Combine and deduplicate
  const combined = [...essential, ...locationSpecific];
  const seen = new Set<string>();
  return combined.filter(st => {
    if (seen.has(st.id)) return false;
    seen.add(st.id);
    return true;
  });
};
