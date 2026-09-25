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

export interface QuoteScope {
  items: ScopeItem[];
  notAvailable: string[];
  derivedAt: string;
  schemaVersion: number;
}
