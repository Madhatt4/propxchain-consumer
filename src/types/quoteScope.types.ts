// Mirrors supabase/functions/_shared/quote-scope.ts. Kept as a hand-written
// mirror rather than generated: the edge function is Deno and this is Vite, and
// the shape is small and stable (schemaVersion guards drift).

export interface ScopeItem {
  key: string;
  category: 'supplement' | 'enquiry' | 'task';
  title: string;
  detail: string;
  trigger: string;
  provenance: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SearchSummaryFlag {
  statement: string;
  searchName: string;
  location?: string;
}

export interface SearchSummarySection {
  provider: string;
  explainer: string;
  flags: SearchSummaryFlag[];
}

/** A shared scan's own words. Reported, not interpreted: nothing here is a line to price. */
export interface SearchSummary {
  sections: SearchSummarySection[];
  truncated: boolean;
}

export const SEARCH_SUMMARY_HEADING = 'Search results summary (automated)';
export const SEARCH_SUMMARY_NOTICE = 'An automated summary of the delivered searches, not legal advice.';
export const SEARCH_SUMMARY_TRUNCATED_NOTICE = 'Part of this summary was left out for length.';

export interface QuoteScope {
  items: ScopeItem[];
  notAvailable: string[];
  derivedAt: string;
  schemaVersion: number;
  searchSummary?: SearchSummary;
}
