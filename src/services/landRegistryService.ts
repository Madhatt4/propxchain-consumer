// Land Registry Price Paid Data API Service
// Free API - No authentication required
// Documentation: http://landregistry.data.gov.uk/

import { logger } from '@/utils/logger';

export interface LandRegistryAddress {
  paon: string;           // Primary Addressable Object Name (house number/name)
  saon: string;           // Secondary Addressable Object Name (flat/unit number)
  street: string;         // Street name
  locality: string;       // Village/hamlet (optional)
  townCity: string;       // Town or city
  district: string;       // District (optional)
  county: string;         // County
  postcode: string;       // Postcode (critical for API lookup)
  propertyType: 'D' | 'S' | 'T' | 'F' | '';  // Detached/Semi/Terraced/Flat
  newBuild: boolean;      // Is this a new build?
  tenure: 'F' | 'L' | ''; // Freehold or Leasehold
}

export interface PricePaidRecord {
  transactionId: string;
  price: number;
  dateOfTransfer: string;  // ISO date
  postcode: string;
  propertyType: string;    // D/S/T/F
  oldNew: string;          // Y/N
  duration: string;        // F/L (Freehold/Leasehold)
  paon: string;
  saon: string;
  street: string;
  locality: string;
  townCity: string;
  district: string;
  county: string;
}

export interface LandRegistryData {
  priceHistory: PricePaidRecord[];
  exactMatches: PricePaidRecord[];
  lastFetched: string | null;
  fetchError: string | null;
}

export interface PriceHistoryResult {
  success: boolean;
  records: PricePaidRecord[];
  error?: string;
}

/**
 * Create default empty Land Registry address
 */
export function createDefaultLandRegistryAddress(): LandRegistryAddress {
  return {
    paon: '',
    saon: '',
    street: '',
    locality: '',
    townCity: '',
    district: '',
    county: '',
    postcode: '',
    propertyType: '',
    newBuild: false,
    tenure: ''
  };
}

/**
 * Create default empty Land Registry data
 */
export function createDefaultLandRegistryData(): LandRegistryData {
  return {
    priceHistory: [],
    exactMatches: [],
    lastFetched: null,
    fetchError: null
  };
}

/**
 * Validate UK postcode format
 */
export function isValidPostcode(postcode: string): boolean {
  // UK postcode regex - matches formats like SW1A 1AA, EC1A 1BB, W1A 0AX, etc.
  const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
  return postcodeRegex.test(postcode.trim());
}

/**
 * Clean and normalize postcode for API lookup
 */
export function cleanPostcode(postcode: string): string {
  return postcode.replace(/\s/g, '').toUpperCase();
}

/**
 * Format postcode for display (add space in correct position)
 */
export function formatPostcode(postcode: string): string {
  const clean = cleanPostcode(postcode);
  if (clean.length < 5) return clean;
  // Insert space before last 3 characters
  return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
}

/**
 * Fetch price history for a property by postcode
 * Uses Land Registry's free REST API
 */
export async function fetchPriceHistory(postcode: string): Promise<PriceHistoryResult> {
  try {
    const cleanedPostcode = cleanPostcode(postcode);

    if (!cleanedPostcode) {
      return { success: false, records: [], error: 'No postcode provided' };
    }

    // Land Registry Price Paid Data API endpoint
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?propertyAddress.postcode=${encodeURIComponent(formatPostcode(cleanedPostcode))}`;

    logger.info('Fetching Land Registry data for postcode:', formatPostcode(cleanedPostcode));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, records: [] }; // No records found, but not an error
      }
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.result || !data.result.items) {
      return { success: true, records: [] };
    }

    // Transform API response to our interface
    const records: PricePaidRecord[] = data.result.items.map((item: any) => ({
      transactionId: item['@id'] || item.transactionId || `tx_${Date.now()}_${Math.random()}`,
      price: parseInt(item.pricePaid) || 0,
      dateOfTransfer: item.transactionDate || '',
      postcode: item.propertyAddress?.postcode || '',
      propertyType: mapPropertyType(item.propertyAddress?.propertyType),
      oldNew: item.newBuild === true ? 'Y' : 'N',
      duration: mapEstateType(item.estateType),
      paon: item.propertyAddress?.paon || '',
      saon: item.propertyAddress?.saon || '',
      street: item.propertyAddress?.street || '',
      locality: item.propertyAddress?.locality || '',
      townCity: item.propertyAddress?.town || '',
      district: item.propertyAddress?.district || '',
      county: item.propertyAddress?.county || ''
    }));

    // Sort by date descending (most recent first)
    records.sort((a, b) =>
      new Date(b.dateOfTransfer).getTime() - new Date(a.dateOfTransfer).getTime()
    );

    logger.info(`Found ${records.length} price records for postcode ${formatPostcode(cleanedPostcode)}`);

    return { success: true, records };

  } catch (error) {
    logger.error('Land Registry API error:', error);
    return {
      success: false,
      records: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Map Land Registry property type URI to code
 */
function mapPropertyType(propertyType: any): string {
  if (!propertyType) return '';
  const typeStr = String(propertyType).toLowerCase();
  if (typeStr.includes('detached') && !typeStr.includes('semi')) return 'D';
  if (typeStr.includes('semi-detached') || typeStr.includes('semi')) return 'S';
  if (typeStr.includes('terraced')) return 'T';
  if (typeStr.includes('flat') || typeStr.includes('maisonette')) return 'F';
  return '';
}

/**
 * Map Land Registry estate type to duration code
 */
function mapEstateType(estateType: any): string {
  if (!estateType) return '';
  const typeStr = String(estateType).toLowerCase();
  if (typeStr.includes('freehold')) return 'F';
  if (typeStr.includes('leasehold')) return 'L';
  return '';
}

/**
 * Find exact property match from price history
 */
export function findExactPropertyMatch(
  records: PricePaidRecord[],
  address: LandRegistryAddress
): PricePaidRecord[] {
  if (!address.paon) return [];

  return records.filter(record => {
    // Match PAON (house number/name) - case insensitive
    const paonMatch = record.paon.toLowerCase().trim() === address.paon.toLowerCase().trim();

    // Match SAON (flat/unit) if specified - case insensitive
    const saonMatch = !address.saon ||
      record.saon.toLowerCase().trim() === address.saon.toLowerCase().trim();

    // Match street - at least first word should match (handles "Road" vs "Rd" etc.)
    const recordStreetFirstWord = record.street.toLowerCase().split(' ')[0];
    const addressStreetFirstWord = address.street.toLowerCase().split(' ')[0];
    const streetMatch = !address.street ||
      recordStreetFirstWord === addressStreetFirstWord ||
      record.street.toLowerCase().includes(address.street.toLowerCase()) ||
      address.street.toLowerCase().includes(record.street.toLowerCase());

    return paonMatch && saonMatch && streetMatch;
  });
}

/**
 * Format price for display (British Pounds)
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Format date for display (e.g., "March 2020")
 */
export function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long'
    });
  } catch {
    return dateString;
  }
}

/**
 * Format full date for display (e.g., "15 March 2020")
 */
export function formatFullDate(dateString: string): string {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

/**
 * Get property type label from code
 */
export function getPropertyTypeLabel(code: string): string {
  switch (code) {
    case 'D': return 'Detached';
    case 'S': return 'Semi-detached';
    case 'T': return 'Terraced';
    case 'F': return 'Flat/Maisonette';
    default: return 'Unknown';
  }
}

/**
 * Get tenure label from code
 */
export function getTenureLabel(code: string): string {
  switch (code) {
    case 'F': return 'Freehold';
    case 'L': return 'Leasehold';
    default: return 'Unknown';
  }
}

/**
 * Build formatted address string from Land Registry address
 */
export function buildAddressString(address: LandRegistryAddress): string {
  const parts: string[] = [];

  if (address.saon) parts.push(address.saon);
  if (address.paon) parts.push(address.paon);
  if (address.street) parts.push(address.street);
  if (address.locality) parts.push(address.locality);
  if (address.townCity) parts.push(address.townCity);
  if (address.county) parts.push(address.county);
  if (address.postcode) parts.push(formatPostcode(address.postcode));

  return parts.join(', ');
}

/**
 * Calculate price change between two records
 */
export function calculatePriceChange(
  currentPrice: number,
  previousPrice: number
): { amount: number; percentage: number; isIncrease: boolean } {
  const amount = currentPrice - previousPrice;
  const percentage = previousPrice > 0 ? ((amount / previousPrice) * 100) : 0;
  return {
    amount,
    percentage: Math.round(percentage * 10) / 10,
    isIncrease: amount > 0
  };
}

/**
 * Extract UK postcode from an address string
 * Returns null if no valid postcode found
 */
export function extractPostcodeFromAddress(address: string): string | null {
  if (!address) return null;

  // UK postcode regex - matches formats like SW1A 1AA, EC1A 1BB, W1A 0AX, etc.
  // Can appear with or without space
  const postcodeRegex = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i;
  const match = address.match(postcodeRegex);

  if (match && match[1]) {
    return formatPostcode(match[1]);
  }
  return null;
}

/**
 * Create a minimal LandRegistryAddress from a string address
 * Extracts postcode and uses full string as street
 */
export function createAddressFromString(addressString: string): LandRegistryAddress | null {
  const postcode = extractPostcodeFromAddress(addressString);
  if (!postcode) return null;

  // Remove postcode from address to get the rest
  const addressWithoutPostcode = addressString
    .replace(/[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}/i, '')
    .replace(/,\s*$/, '')
    .trim();

  // Try to extract house number (PAON) from start of address
  const paonMatch = addressWithoutPostcode.match(/^(\d+[A-Za-z]?)\s+(.+)/);

  return {
    paon: paonMatch ? paonMatch[1] : '',
    saon: '',
    street: paonMatch ? paonMatch[2].split(',')[0].trim() : addressWithoutPostcode.split(',')[0].trim(),
    locality: '',
    townCity: '',
    district: '',
    county: '',
    postcode: postcode,
    propertyType: '',
    newBuild: false,
    tenure: ''
  };
}

/**
 * Land Registry service URLs (paid services require account)
 */
export const LAND_REGISTRY_URLS = {
  // Free services
  pricePaidSearch: 'https://landregistry.data.gov.uk/app/ppd',
  openData: 'https://landregistry.data.gov.uk/',

  // Paid services (require account)
  searchProperty: 'https://search-property-information.service.gov.uk/',
  titleSearch: 'https://search-property-information.service.gov.uk/search/search-by-postcode',
  officialCopies: 'https://www.gov.uk/get-information-about-property-and-land/copies-of-deeds',

  // Account management
  createAccount: 'https://use-land-property-data.service.gov.uk/registration/new',
  signIn: 'https://use-land-property-data.service.gov.uk/sign-in',

  // API documentation
  apiDocs: 'https://use-land-property-data.service.gov.uk/api-information'
};
