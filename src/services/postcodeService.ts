// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { logger } from '@/utils/logger';

/**
 * Postcodes.io API Response Types
 * Free UK postcode & geolocation API - https://postcodes.io/
 */
export interface PostcodeResult {
  postcode: string;
  quality: number;
  eastings: number | null;
  northings: number | null;
  country: string;
  nhs_ha: string | null;
  longitude: number | null;
  latitude: number | null;
  european_electoral_region: string | null;
  primary_care_trust: string | null;
  region: string | null;
  lsoa: string | null;
  msoa: string | null;
  incode: string;
  outcode: string;
  parliamentary_constituency: string | null;
  parliamentary_constituency_2024: string | null;
  admin_district: string | null;
  parish: string | null;
  admin_county: string | null;
  date_of_introduction: string | null;
  admin_ward: string | null;
  ced: string | null;
  ccg: string | null;
  nuts: string | null;
  pfa: string | null;
  codes: {
    admin_district: string | null;
    admin_county: string | null;
    admin_ward: string | null;
    parish: string | null;
    parliamentary_constituency: string | null;
    parliamentary_constituency_2024: string | null;
    ccg: string | null;
    ccg_id: string | null;
    ced: string | null;
    nuts: string | null;
    lsoa: string | null;
    msoa: string | null;
    lau2: string | null;
    pfa: string | null;
  };
}

export interface PostcodeApiResponse {
  status: number;
  result: PostcodeResult | null;
  error?: string;
}

export interface BulkPostcodeResult {
  query: string;
  result: PostcodeResult | null;
}

export interface BulkPostcodeApiResponse {
  status: number;
  result: BulkPostcodeResult[];
}

/**
 * Local Authority Information extracted from postcode lookup
 */
export interface LocalAuthorityInfo {
  postcode: string;
  adminDistrict: string | null;
  adminCounty: string | null;
  region: string | null;
  country: string;
  parish: string | null;
  ward: string | null;
  constituency: string | null;
  latitude: number | null;
  longitude: number | null;
  codes: {
    adminDistrict: string | null;
    adminCounty: string | null;
  };
}

/**
 * Search recommendation based on location
 */
export interface SearchRecommendation {
  searchTypeId: string;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Location-based search analysis result
 */
export interface LocationSearchAnalysis {
  localAuthority: LocalAuthorityInfo;
  recommendations: SearchRecommendation[];
  warnings: string[];
  additionalInfo: string[];
}

// Postcodes.io API base URL
const POSTCODES_API_BASE = 'https://api.postcodes.io';

/**
 * Postcode Service
 * Integrates with Postcodes.io for UK postcode lookups and
 * provides location-based property search recommendations
 */
class PostcodeService {
  private cache: Map<string, { data: PostcodeResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

  /**
   * Normalize postcode format (remove spaces, uppercase)
   */
  normalizePostcode(postcode: string): string {
    return postcode.replace(/\s+/g, '').toUpperCase();
  }

  /**
   * Format postcode with space (e.g., "SW1A 1AA")
   */
  formatPostcode(postcode: string): string {
    const normalized = this.normalizePostcode(postcode);
    if (normalized.length < 5) return normalized;
    const incode = normalized.slice(-3);
    const outcode = normalized.slice(0, -3);
    return `${outcode} ${incode}`;
  }

  /**
   * Validate UK postcode format (FULL postcode, e.g. "SG19 1AB").
   * Outcode-only inputs (e.g. "SG19") return false — use isOutcodeOnly for those.
   */
  isValidPostcodeFormat(postcode: string): boolean {
    const normalized = this.normalizePostcode(postcode);
    // UK postcode regex pattern
    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;
    return postcodeRegex.test(normalized);
  }

  /** Alias of isValidPostcodeFormat — read more clearly at call sites that
   *  branch on "do we have a full postcode or just an outcode?". */
  isFullPostcode(postcode: string): boolean {
    return this.isValidPostcodeFormat(postcode);
  }

  /**
   * True for outcode-only strings (e.g. "SG19", "EC1A", "M1"). Returns false
   * for full postcodes and for garbage. Listing scrapers (Rightmove, Hiizzy,
   * OnTheMarket) regularly only surface outcodes from public pages, so we
   * recognise this case and prompt for the rest before calling paid HMLR /
   * postcodes.io endpoints.
   */
  isOutcodeOnly(postcode: string): boolean {
    const normalized = this.normalizePostcode(postcode);
    if (this.isValidPostcodeFormat(postcode)) return false;
    // Outcode = 1-2 letters + 1 digit + optional letter-or-digit (e.g. EC1A)
    return /^[A-Z]{1,2}[0-9][0-9A-Z]?$/.test(normalized);
  }

  /**
   * Split a normalised postcode into outcode + incode. For an outcode-only
   * input the incode is the empty string.
   */
  splitPostcode(postcode: string): { outcode: string; incode: string } {
    const normalized = this.normalizePostcode(postcode);
    if (this.isValidPostcodeFormat(postcode)) {
      return { outcode: normalized.slice(0, -3), incode: normalized.slice(-3) };
    }
    if (this.isOutcodeOnly(postcode)) {
      return { outcode: normalized, incode: '' };
    }
    return { outcode: '', incode: '' };
  }

  /**
   * Combine a known outcode with a user-provided incode into a full postcode
   * (validated + formatted with a space). Returns null if the result isn't a
   * valid full UK postcode — caller surfaces a user-facing error.
   */
  completePostcode(outcode: string, incode: string): string | null {
    const cleanOutcode = this.normalizePostcode(outcode);
    const cleanIncode = this.normalizePostcode(incode);
    if (!this.isOutcodeOnly(cleanOutcode)) return null;
    const combined = `${cleanOutcode}${cleanIncode}`;
    if (!this.isValidPostcodeFormat(combined)) return null;
    return this.formatPostcode(combined);
  }

  /**
   * Lookup a single postcode
   */
  async lookupPostcode(postcode: string): Promise<PostcodeResult | null> {
    const normalized = this.normalizePostcode(postcode);

    // Check cache first
    const cached = this.cache.get(normalized);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info('Postcode cache hit:', normalized);
      return cached.data;
    }

    try {
      logger.info('Looking up postcode:', normalized);
      const response = await fetch(`${POSTCODES_API_BASE}/postcodes/${encodeURIComponent(normalized)}`);

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn('Postcode not found:', normalized);
          return null;
        }
        throw new Error(`Postcode API error: ${response.status}`);
      }

      const data: PostcodeApiResponse = await response.json();

      if (data.status === 200 && data.result) {
        // Cache the result
        this.cache.set(normalized, { data: data.result, timestamp: Date.now() });
        return data.result;
      }

      return null;
    } catch (error) {
      logger.error('Postcode lookup failed:', error);
      throw error;
    }
  }

  /**
   * Lookup multiple postcodes in bulk (max 100)
   */
  async lookupPostcodesBulk(postcodes: string[]): Promise<Map<string, PostcodeResult | null>> {
    const results = new Map<string, PostcodeResult | null>();
    const toFetch: string[] = [];

    // Check cache first
    for (const postcode of postcodes) {
      const normalized = this.normalizePostcode(postcode);
      const cached = this.cache.get(normalized);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        results.set(normalized, cached.data);
      } else {
        toFetch.push(normalized);
      }
    }

    if (toFetch.length === 0) {
      return results;
    }

    try {
      const response = await fetch(`${POSTCODES_API_BASE}/postcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: toFetch }),
      });

      if (!response.ok) {
        throw new Error(`Bulk postcode API error: ${response.status}`);
      }

      const data: BulkPostcodeApiResponse = await response.json();

      for (const item of data.result) {
        const normalized = this.normalizePostcode(item.query);
        results.set(normalized, item.result);
        if (item.result) {
          this.cache.set(normalized, { data: item.result, timestamp: Date.now() });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk postcode lookup failed:', error);
      throw error;
    }
  }

  /**
   * Validate a postcode exists
   */
  async validatePostcode(postcode: string): Promise<boolean> {
    const normalized = this.normalizePostcode(postcode);

    try {
      const response = await fetch(`${POSTCODES_API_BASE}/postcodes/${encodeURIComponent(normalized)}/validate`);
      const data = await response.json();
      return data.result === true;
    } catch (error) {
      logger.error('Postcode validation failed:', error);
      return false;
    }
  }

  /**
   * Autocomplete postcode (for search input)
   */
  async autocompletePostcode(partial: string, limit: number = 10): Promise<string[]> {
    if (partial.length < 2) return [];

    try {
      const response = await fetch(
        `${POSTCODES_API_BASE}/postcodes/${encodeURIComponent(partial)}/autocomplete?limit=${limit}`
      );
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      logger.error('Postcode autocomplete failed:', error);
      return [];
    }
  }

  /**
   * Get nearest postcodes to coordinates
   */
  async getNearestPostcodes(lat: number, lon: number, limit: number = 10): Promise<PostcodeResult[]> {
    try {
      const response = await fetch(
        `${POSTCODES_API_BASE}/postcodes?lon=${lon}&lat=${lat}&limit=${limit}`
      );
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      logger.error('Nearest postcodes lookup failed:', error);
      return [];
    }
  }

  /**
   * Extract local authority information from postcode result
   */
  extractLocalAuthorityInfo(result: PostcodeResult): LocalAuthorityInfo {
    return {
      postcode: result.postcode,
      adminDistrict: result.admin_district,
      adminCounty: result.admin_county,
      region: result.region,
      country: result.country,
      parish: result.parish,
      ward: result.admin_ward,
      constituency: result.parliamentary_constituency_2024 || result.parliamentary_constituency,
      latitude: result.latitude,
      longitude: result.longitude,
      codes: {
        adminDistrict: result.codes.admin_district,
        adminCounty: result.codes.admin_county,
      },
    };
  }

  /**
   * Get local authority info for a postcode
   */
  async getLocalAuthorityInfo(postcode: string): Promise<LocalAuthorityInfo | null> {
    const result = await this.lookupPostcode(postcode);
    if (!result) return null;
    return this.extractLocalAuthorityInfo(result);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Postcode cache cleared');
  }
}

/** Haversine distance in miles between two lat/lng points. */
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Export singleton instance
export const postcodeService = new PostcodeService();
