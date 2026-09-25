// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useState, useCallback, useEffect } from 'react';
import {
  postcodeService,
  PostcodeResult,
  LocalAuthorityInfo,
  SearchRecommendation,
} from '../services/postcodeService';
import {
  analyzeLocationForSearches,
  LocationSearchAnalysis,
} from '../utils/searchRegionMapping';
import { getSearchTypeById } from '../utils/searchTypes';
import { SearchType } from '../types/searches';

/**
 * Postcode lookup state
 */
interface PostcodeLookupState {
  isLoading: boolean;
  error: string | null;
  postcodeResult: PostcodeResult | null;
  localAuthority: LocalAuthorityInfo | null;
  searchAnalysis: LocationSearchAnalysis | null;
  isValid: boolean;
}

/**
 * Enriched search recommendation with full search type info
 */
export interface EnrichedSearchRecommendation {
  searchType: SearchType;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Hook return type
 */
interface UsePostcodeLookupReturn extends PostcodeLookupState {
  lookupPostcode: (postcode: string) => Promise<void>;
  validatePostcode: (postcode: string) => Promise<boolean>;
  autocomplete: (partial: string) => Promise<string[]>;
  clearResults: () => void;
  getEnrichedRecommendations: () => EnrichedSearchRecommendation[];
  getRequiredSearches: () => SearchType[];
  getRecommendedSearches: () => SearchType[];
  getOptionalSearches: () => SearchType[];
  formatPostcode: (postcode: string) => string;
}

/**
 * Hook for postcode lookup and search recommendations
 *
 * @example
 * ```tsx
 * const {
 *   lookupPostcode,
 *   localAuthority,
 *   searchAnalysis,
 *   isLoading,
 *   error,
 *   getRequiredSearches,
 * } = usePostcodeLookup();
 *
 * // In a form submit handler:
 * await lookupPostcode('SW1A 1AA');
 *
 * // Get required searches for the location:
 * const required = getRequiredSearches();
 * ```
 */
export function usePostcodeLookup(initialPostcode?: string): UsePostcodeLookupReturn {
  const [state, setState] = useState<PostcodeLookupState>({
    isLoading: false,
    error: null,
    postcodeResult: null,
    localAuthority: null,
    searchAnalysis: null,
    isValid: false,
  });

  /**
   * Lookup a postcode and analyze search requirements
   */
  const lookupPostcode = useCallback(async (postcode: string) => {
    if (!postcode || postcode.trim().length < 3) {
      setState(prev => ({
        ...prev,
        error: 'Please enter a valid postcode',
        isValid: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First validate the postcode format
      if (!postcodeService.isValidPostcodeFormat(postcode)) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Invalid postcode format',
          isValid: false,
        }));
        return;
      }

      // Lookup the postcode
      const result = await postcodeService.lookupPostcode(postcode);

      if (!result) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Postcode not found',
          postcodeResult: null,
          localAuthority: null,
          searchAnalysis: null,
          isValid: false,
        }));
        return;
      }

      // Extract local authority info
      const localAuthority = postcodeService.extractLocalAuthorityInfo(result);

      // Analyze for search recommendations
      const searchAnalysis = analyzeLocationForSearches(localAuthority);

      setState({
        isLoading: false,
        error: null,
        postcodeResult: result,
        localAuthority,
        searchAnalysis,
        isValid: true,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to lookup postcode',
        isValid: false,
      }));
    }
  }, []);

  /**
   * Validate a postcode exists
   */
  const validatePostcode = useCallback(async (postcode: string): Promise<boolean> => {
    try {
      return await postcodeService.validatePostcode(postcode);
    } catch {
      return false;
    }
  }, []);

  /**
   * Autocomplete postcode input
   */
  const autocomplete = useCallback(async (partial: string): Promise<string[]> => {
    if (partial.length < 2) return [];
    try {
      return await postcodeService.autocompletePostcode(partial);
    } catch {
      return [];
    }
  }, []);

  /**
   * Clear all results
   */
  const clearResults = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      postcodeResult: null,
      localAuthority: null,
      searchAnalysis: null,
      isValid: false,
    });
  }, []);

  /**
   * Get enriched recommendations with full search type info
   */
  const getEnrichedRecommendations = useCallback((): EnrichedSearchRecommendation[] => {
    if (!state.searchAnalysis) return [];

    return state.searchAnalysis.recommendations
      .map((rec: SearchRecommendation) => {
        const searchType = getSearchTypeById(rec.searchTypeId);
        if (!searchType) return null;
        return {
          searchType,
          reason: rec.reason,
          priority: rec.priority,
          confidence: rec.confidence,
        };
      })
      .filter(
        (rec: EnrichedSearchRecommendation | null): rec is EnrichedSearchRecommendation =>
          rec !== null
      );
  }, [state.searchAnalysis]);

  /**
   * Get required searches for this location
   */
  const getRequiredSearches = useCallback((): SearchType[] => {
    return getEnrichedRecommendations()
      .filter(rec => rec.priority === 'required')
      .map(rec => rec.searchType);
  }, [getEnrichedRecommendations]);

  /**
   * Get recommended (but not required) searches
   */
  const getRecommendedSearches = useCallback((): SearchType[] => {
    return getEnrichedRecommendations()
      .filter(rec => rec.priority === 'recommended')
      .map(rec => rec.searchType);
  }, [getEnrichedRecommendations]);

  /**
   * Get optional searches
   */
  const getOptionalSearches = useCallback((): SearchType[] => {
    return getEnrichedRecommendations()
      .filter(rec => rec.priority === 'optional')
      .map(rec => rec.searchType);
  }, [getEnrichedRecommendations]);

  /**
   * Format a postcode
   */
  const formatPostcode = useCallback((postcode: string): string => {
    return postcodeService.formatPostcode(postcode);
  }, []);

  // Auto-lookup if initial postcode provided
  useEffect(() => {
    if (initialPostcode) {
      lookupPostcode(initialPostcode);
    }
  }, [initialPostcode, lookupPostcode]);

  return {
    ...state,
    lookupPostcode,
    validatePostcode,
    autocomplete,
    clearResults,
    getEnrichedRecommendations,
    getRequiredSearches,
    getRecommendedSearches,
    getOptionalSearches,
    formatPostcode,
  };
}

/**
 * Hook for postcode autocomplete input
 * Debounced autocomplete suggestions
 */
export function usePostcodeAutocomplete(debounceMs: number = 300) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getSuggestions = useCallback(async (partial: string) => {
    if (partial.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await postcodeService.autocompletePostcode(partial);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced version
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const debouncedGetSuggestions = useCallback((partial: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      getSuggestions(partial);
    }, debounceMs);

    setDebounceTimer(timer);
  }, [debounceMs, debounceTimer, getSuggestions]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    getSuggestions: debouncedGetSuggestions,
    clearSuggestions,
  };
}

export default usePostcodeLookup;
