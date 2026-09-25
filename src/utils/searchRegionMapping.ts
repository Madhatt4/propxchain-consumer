// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import {
  LocalAuthorityInfo,
  SearchRecommendation,
  LocationSearchAnalysis,
} from '../services/postcodeService';
import { getSearchTypeById, getAllSearchTypes } from './searchTypes';

// Re-export so consumers (e.g. usePostcodeLookup) can import the analysis
// shape from this module rather than reaching into postcodeService directly.
export type { LocationSearchAnalysis } from '../services/postcodeService';

/**
 * Coal mining affected areas
 * Source: Coal Authority data
 * These local authorities have known coal mining history
 */
const COAL_MINING_DISTRICTS: string[] = [
  // Yorkshire & Humber
  'Barnsley', 'Doncaster', 'Rotherham', 'Sheffield', 'Wakefield', 'Leeds', 'Kirklees',
  'Selby', 'North Yorkshire', 'Bradford',
  // East Midlands
  'Derbyshire', 'Nottinghamshire', 'Leicestershire', 'Bolsover', 'Chesterfield',
  'North East Derbyshire', 'Amber Valley', 'Erewash', 'South Derbyshire',
  'Ashfield', 'Bassetlaw', 'Broxtowe', 'Gedling', 'Mansfield', 'Newark and Sherwood',
  'Rushcliffe', 'North West Leicestershire',
  // West Midlands
  'Dudley', 'Sandwell', 'Walsall', 'Wolverhampton', 'Birmingham', 'Cannock Chase', 'South Staffordshire',
  'Staffordshire', 'Tamworth', 'Lichfield',
  // North East
  'County Durham', 'Northumberland', 'Gateshead', 'Newcastle upon Tyne', 'North Tyneside',
  'South Tyneside', 'Sunderland', 'Durham',
  // North West
  'Wigan', 'St. Helens', 'Bolton', 'Bury', 'Oldham', 'Rochdale', 'Salford', 'Tameside',
  'Warrington', 'Halton', 'Knowsley', 'Liverpool',
  // Wales
  'Blaenau Gwent', 'Bridgend', 'Caerphilly', 'Carmarthenshire', 'Merthyr Tydfil',
  'Neath Port Talbot', 'Rhondda Cynon Taf', 'Swansea', 'Torfaen', 'Wrexham',
  'Flintshire', 'Denbighshire', 'Powys',
];

/**
 * Brine/Salt mining affected areas (Cheshire salt fields)
 */
const BRINE_MINING_DISTRICTS: string[] = [
  'Cheshire East', 'Cheshire West and Chester', 'Halton', 'Warrington',
  // Specific towns/areas
  'Northwich', 'Middlewich', 'Nantwich', 'Winsford', 'Sandbach',
  'Alsager', 'Congleton', 'Crewe', 'Knutsford', 'Macclesfield',
  // Worcestershire (Droitwich)
  'Wychavon', 'Worcester', 'Worcestershire',
];

/**
 * Tin mining affected areas (Cornwall & Devon)
 */
const TIN_MINING_DISTRICTS: string[] = [
  'Cornwall', 'Isles of Scilly',
  // Devon (western parts)
  'West Devon', 'Teignbridge', 'South Hams',
  // Specific areas
  'Camborne', 'Redruth', 'St Austell', 'Truro', 'Penzance', 'Falmouth',
  // Pre-2009 districts, abolished into the Cornwall unitary. Kept because
  // legacy records and older address data still carry them.
  'Penwith', 'Kerrier', 'Carrick',
];

/**
 * Clay mining affected areas
 */
const CLAY_MINING_DISTRICTS: string[] = [
  'Stoke-on-Trent', 'Newcastle-under-Lyme', 'Staffordshire Moorlands',
  'Central Bedfordshire', 'Bedford', 'Peterborough',
  // Cornwall china clay
  'Cornwall',
];

/**
 * Limestone mining affected areas
 */
const LIMESTONE_MINING_DISTRICTS: string[] = [
  // Peak District / Derbyshire
  'Derbyshire Dales', 'High Peak', 'Derbyshire',
  // Yorkshire
  'Craven', 'Richmondshire', 'North Yorkshire',
  // Somerset / Mendips
  'Mendip', 'Somerset', 'Bath and North East Somerset',
  // Gloucestershire / Cotswolds
  'Cotswold', 'Stroud', 'Gloucestershire', 'Forest of Dean',
];

/**
 * HS2 route affected areas
 */
const HS2_AFFECTED_DISTRICTS: string[] = [
  // London
  'Camden', 'Westminster', 'Brent', 'Ealing', 'Hillingdon',
  // Buckinghamshire
  'Buckinghamshire', 'Aylesbury Vale', 'Chiltern', 'South Bucks',
  // Northamptonshire
  'South Northamptonshire', 'West Northamptonshire',
  // Warwickshire
  'Warwick', 'Stratford-on-Avon', 'Solihull',
  // West Midlands
  'Birmingham', 'Solihull',
  // Staffordshire
  'Lichfield', 'South Staffordshire', 'Stafford',
  // East Midlands (Phase 2)
  'North West Leicestershire', 'South Derbyshire', 'Erewash',
  'Broxtowe', 'Rushcliffe', 'Nottingham',
  // Yorkshire (Phase 2)
  'Sheffield', 'Rotherham', 'Barnsley', 'Wakefield', 'Leeds',
];

/**
 * Crossrail/Elizabeth Line affected areas
 */
const CROSSRAIL_AFFECTED_DISTRICTS: string[] = [
  // Central London
  'City of London', 'Westminster', 'Camden', 'Islington', 'Tower Hamlets',
  'Hackney', 'Newham', 'Southwark',
  // West London
  'Ealing', 'Hillingdon', 'Hounslow', 'Hammersmith and Fulham', 'Kensington and Chelsea',
  // East London
  'Barking and Dagenham', 'Havering', 'Redbridge',
  // Essex
  'Brentwood',
  // Berkshire
  'Slough', 'Windsor and Maidenhead', 'Reading', 'West Berkshire', 'Wokingham',
];

/**
 * Radon affected areas (simplified - high risk zones)
 * Note: For accurate radon risk, use PHE/UKHSA radon data
 */
const RADON_HIGH_RISK_REGIONS: string[] = [
  'Cornwall', 'Devon', 'Somerset', 'Derbyshire', 'Northamptonshire',
];

/**
 * Flood risk coastal areas
 */
const COASTAL_FLOOD_RISK_DISTRICTS: string[] = [
  // East coast
  'Boston', 'South Holland', 'East Lindsey', 'King\'s Lynn and West Norfolk',
  'Great Yarmouth', 'North Norfolk', 'Waveney', 'Suffolk Coastal',
  'Tendring', 'Maldon', 'Rochford', 'Castle Point', 'Southend-on-Sea',
  'Thurrock', 'Medway', 'Swale', 'Canterbury', 'Dover', 'Folkestone and Hythe',
  // South coast
  'Rother', 'Lewes', 'Brighton and Hove', 'Adur', 'Worthing', 'Arun',
  'Chichester', 'Havant', 'Portsmouth', 'Gosport', 'Fareham', 'Southampton',
  'New Forest', 'Christchurch', 'Bournemouth', 'Poole',
  // West coast / Bristol Channel
  'North Somerset', 'Sedgemoor', 'West Somerset', 'North Devon', 'Torridge',
];

/**
 * Check if a string matches any item in an array (case-insensitive, partial match)
 */
function matchesAny(value: string | null, list: string[]): boolean {
  if (!value) return false;
  const lowerValue = value.toLowerCase();
  return list.some(item =>
    lowerValue.includes(item.toLowerCase()) ||
    item.toLowerCase().includes(lowerValue)
  );
}

/**
 * Analyze location and generate search recommendations
 */
export function analyzeLocationForSearches(localAuthority: LocalAuthorityInfo): LocationSearchAnalysis {
  const recommendations: SearchRecommendation[] = [];
  const warnings: string[] = [];
  const additionalInfo: string[] = [];

  const district = localAuthority.adminDistrict;
  const county = localAuthority.adminCounty;
  const region = localAuthority.region;
  const country = localAuthority.country;

  // Helper to add recommendation
  const addRecommendation = (
    searchTypeId: string,
    reason: string,
    priority: 'required' | 'recommended' | 'optional',
    confidence: 'high' | 'medium' | 'low'
  ) => {
    const searchType = getSearchTypeById(searchTypeId);
    if (searchType) {
      recommendations.push({ searchTypeId, reason, priority, confidence });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ESSENTIAL SEARCHES (Always required)
  // ═══════════════════════════════════════════════════════════════

  addRecommendation(
    'local-authority-search',
    'Required for all property transactions - reveals planning, building control, and road information',
    'required',
    'high'
  );

  addRecommendation(
    'drainage-water-search',
    'Required to confirm water supply and sewerage connections',
    'required',
    'high'
  );

  addRecommendation(
    'environmental-search',
    'Required to identify contamination, flooding, and environmental hazards',
    'required',
    'high'
  );

  addRecommendation(
    'land-registry-title',
    'Required to verify ownership and identify any restrictions on the property',
    'required',
    'high'
  );

  // ═══════════════════════════════════════════════════════════════
  // LOCATION-SPECIFIC SEARCHES
  // ═══════════════════════════════════════════════════════════════

  // Coal Mining Search
  if (matchesAny(district, COAL_MINING_DISTRICTS) ||
      matchesAny(county, COAL_MINING_DISTRICTS) ||
      matchesAny(region, COAL_MINING_DISTRICTS)) {
    addRecommendation(
      'coal-mining-con29m',
      `${district || county || region} is in a coal mining affected area - CON29M search required`,
      'required',
      'high'
    );
    warnings.push('This property is in a known coal mining area. A Coal Mining Search (CON29M) is essential to check for mine shafts, tunnels, and subsidence risk.');
  }

  // Brine/Salt Mining Search
  if (matchesAny(district, BRINE_MINING_DISTRICTS) ||
      matchesAny(county, BRINE_MINING_DISTRICTS)) {
    addRecommendation(
      'brine-subsidence',
      `${district || county} has historical brine/salt extraction - subsidence check required`,
      'required',
      'high'
    );
    warnings.push('This property is in a salt mining area. Brine pumping can cause significant ground movement and subsidence.');
  }

  // Tin Mining Search (Cornwall/Devon)
  if (matchesAny(district, TIN_MINING_DISTRICTS) ||
      matchesAny(county, TIN_MINING_DISTRICTS)) {
    addRecommendation(
      'tin-mining',
      `${district || county} has historical tin mining activity`,
      'required',
      'high'
    );
    warnings.push('This property is in a tin mining area. A tin mining search is recommended to check for mine workings that could affect ground stability.');
    additionalInfo.push('Consider also requesting a Mundic survey if the search reveals former mine workings nearby.');
  }

  // Clay Mining Search
  if (matchesAny(district, CLAY_MINING_DISTRICTS) ||
      matchesAny(county, CLAY_MINING_DISTRICTS)) {
    addRecommendation(
      'clay-mining',
      `${district || county} has historical clay extraction`,
      'recommended',
      'medium'
    );
    additionalInfo.push('This area has historical clay extraction. Consider a clay mining search if the property is near known extraction sites.');
  }

  // Limestone Mining Search
  if (matchesAny(district, LIMESTONE_MINING_DISTRICTS) ||
      matchesAny(county, LIMESTONE_MINING_DISTRICTS)) {
    addRecommendation(
      'limestone-mining',
      `${district || county} has limestone geology with potential quarrying`,
      'recommended',
      'medium'
    );
  }

  // HS2 Search
  if (matchesAny(district, HS2_AFFECTED_DISTRICTS) ||
      matchesAny(county, HS2_AFFECTED_DISTRICTS)) {
    addRecommendation(
      'hs2-search',
      `${district || county} is on or near the HS2 route`,
      'recommended',
      'medium'
    );
    additionalInfo.push('This area may be affected by HS2 construction. Check for safeguarded land and potential compensation schemes.');
  }

  // Crossrail/Elizabeth Line Search
  if (matchesAny(district, CROSSRAIL_AFFECTED_DISTRICTS)) {
    addRecommendation(
      'crossrail-search',
      `${district} is near the Elizabeth Line route`,
      'optional',
      'medium'
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // REGION-BASED RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════

  // Radon Risk
  if (matchesAny(county, RADON_HIGH_RISK_REGIONS) ||
      matchesAny(region, RADON_HIGH_RISK_REGIONS)) {
    additionalInfo.push(`${county || region} has elevated radon gas risk. The Environmental Search should include radon assessment.`);
  }

  // Coastal Flood Risk
  if (matchesAny(district, COASTAL_FLOOD_RISK_DISTRICTS)) {
    addRecommendation(
      'flood-risk',
      `${district} is a coastal area with potential flood risk`,
      'recommended',
      'medium'
    );
    additionalInfo.push('This is a coastal area. Consider a detailed flood risk assessment including coastal and tidal flooding.');
  }

  // Chancel Repair - recommend for all properties
  addRecommendation(
    'chancel-repair',
    'Recommended to check for chancel repair liability to local churches',
    'recommended',
    'medium'
  );

  // Wales-specific
  if (country === 'Wales') {
    additionalInfo.push('Property is in Wales. Some searches may have different procedures or additional Welsh language requirements.');
  }

  // Scotland - note that system is different
  if (country === 'Scotland') {
    warnings.push('Property is in Scotland. Scottish conveyancing uses a different system. Many of these searches may not apply or have Scottish equivalents.');
  }

  // Northern Ireland
  if (country === 'Northern Ireland') {
    warnings.push('Property is in Northern Ireland. Northern Irish conveyancing has different procedures. Consult a local solicitor.');
  }

  // Sort recommendations by priority
  const priorityOrder = { required: 0, recommended: 1, optional: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    localAuthority,
    recommendations,
    warnings,
    additionalInfo,
  };
}

/**
 * Get required search type IDs for a location
 */
export function getRequiredSearchesForLocation(localAuthority: LocalAuthorityInfo): string[] {
  const analysis = analyzeLocationForSearches(localAuthority);
  return analysis.recommendations
    .filter(r => r.priority === 'required')
    .map(r => r.searchTypeId);
}

/**
 * Get all recommended search type IDs for a location (required + recommended)
 */
export function getRecommendedSearchesForLocation(localAuthority: LocalAuthorityInfo): string[] {
  const analysis = analyzeLocationForSearches(localAuthority);
  return analysis.recommendations
    .filter(r => r.priority === 'required' || r.priority === 'recommended')
    .map(r => r.searchTypeId);
}

/**
 * Check if a specific search is required for a location
 */
export function isSearchRequiredForLocation(
  searchTypeId: string,
  localAuthority: LocalAuthorityInfo
): boolean {
  const analysis = analyzeLocationForSearches(localAuthority);
  const recommendation = analysis.recommendations.find(r => r.searchTypeId === searchTypeId);
  return recommendation?.priority === 'required';
}

/**
 * Get searches NOT typically needed for a location
 * (Helps solicitors know what they can skip)
 */
export function getUnnecessarySearchesForLocation(localAuthority: LocalAuthorityInfo): string[] {
  const analysis = analyzeLocationForSearches(localAuthority);
  const recommendedIds = analysis.recommendations.map(r => r.searchTypeId);
  const allSearchTypes = getAllSearchTypes();

  return allSearchTypes
    .filter(st => st.category === 'location-specific' && !recommendedIds.includes(st.id))
    .map(st => st.id);
}

/**
 * Export the district lists for external use
 */
export const MINING_AREAS = {
  coal: COAL_MINING_DISTRICTS,
  brine: BRINE_MINING_DISTRICTS,
  tin: TIN_MINING_DISTRICTS,
  clay: CLAY_MINING_DISTRICTS,
  limestone: LIMESTONE_MINING_DISTRICTS,
};

export const INFRASTRUCTURE_AREAS = {
  hs2: HS2_AFFECTED_DISTRICTS,
  crossrail: CROSSRAIL_AFFECTED_DISTRICTS,
};

export const ENVIRONMENTAL_AREAS = {
  radon: RADON_HIGH_RISK_REGIONS,
  coastalFlood: COASTAL_FLOOD_RISK_DISTRICTS,
};

/**
 * Capability tags for a location, in the vocabulary the provider cards use.
 *
 * This is the single source of area capabilities. SearchesPanel previously
 * carried its own `getCapabilitiesForArea` over a hardcoded town list; this
 * function replaces it using the curated district data already in this module.
 *
 * The tag names are the provider cards' contract, not this module's:
 * CAPABILITY_TO_ITEM_IDS, OneSearchProductListCard and
 * GroundsureProductListCard all key off these exact strings. Note that
 * `stone-mining` is this module's `limestone` under the cards' name — renaming
 * either side would silently drop products from the tick-box lists.
 */
export type AreaCapability = 'coal-mining' | 'brine' | 'tin-mining' | 'stone-mining';

const CAPABILITY_DISTRICTS: ReadonlyArray<readonly [AreaCapability, string[]]> = [
  ['coal-mining', MINING_AREAS.coal],
  ['brine', MINING_AREAS.brine],
  ['tin-mining', MINING_AREAS.tin],
  ['stone-mining', MINING_AREAS.limestone],
];

export function getAreaCapabilities(localAuthority: LocalAuthorityInfo): AreaCapability[] {
  const { adminDistrict, adminCounty, region } = localAuthority;

  return CAPABILITY_DISTRICTS.filter(
    ([, districts]) =>
      matchesAny(adminDistrict, districts) ||
      matchesAny(adminCounty, districts) ||
      matchesAny(region, districts),
  ).map(([capability]) => capability);
}
