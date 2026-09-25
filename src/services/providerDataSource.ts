import type { Provider } from '../components/providers/types';
import {
  amlProviders,
  searchProviders,
  conveyancerProviders,
  surveyProviders,
} from '../components/providers/providerData';
import { SupabaseProviderDataSource } from './supabaseProviderDataSource';

export type ProviderCategory = 'aml_kyc' | 'searches' | 'conveyancer' | 'survey';

export interface ProviderDataSourceOptions {
  postcode?: string;
  sortBy?: 'price' | 'rating' | 'turnaround' | 'distance';
  /** Restrict results to these provider ids BEFORE sorting/slicing —
   *  used by the lender-panel filter so "top 5 nearest" means the 5
   *  nearest firms on the lender's panel. undefined = no restriction. */
  filterIds?: string[];
}

export interface ProviderDataSource {
  getProviders(
    category: ProviderCategory,
    options?: ProviderDataSourceOptions,
  ): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | null>;
}

const CATEGORY_DATA: Record<ProviderCategory, Provider[]> = {
  aml_kyc: amlProviders,
  searches: searchProviders,
  conveyancer: conveyancerProviders,
  survey: surveyProviders,
};

export class StaticProviderDataSource implements ProviderDataSource {
  async getProviders(
    category: ProviderCategory,
    options?: ProviderDataSourceOptions,
  ): Promise<Provider[]> {
    const providers = [...(CATEGORY_DATA[category] ?? [])];

    if (options?.sortBy === 'price') {
      // Unpriced providers sort last: a missing figure is not a cheap one.
      providers.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (options?.sortBy === 'rating') {
      providers.sort((a, b) => b.rating - a.rating);
    }

    return providers;
  }

  async getProvider(id: string): Promise<Provider | null> {
    for (const providers of Object.values(CATEGORY_DATA)) {
      const found = providers.find((p) => p.id === id);
      if (found) return found;
    }
    return null;
  }
}

/**
 * Delegates conveyancer category to SupabaseProviderDataSource (real panel data),
 * everything else falls through to StaticProviderDataSource (mock data).
 */
export class HybridProviderDataSource implements ProviderDataSource {
  private readonly supabaseSource = new SupabaseProviderDataSource();
  private readonly staticSource = new StaticProviderDataSource();

  async getProviders(
    category: ProviderCategory,
    options?: ProviderDataSourceOptions,
  ): Promise<Provider[]> {
    if (category === 'conveyancer') {
      return this.supabaseSource.getProviders(category, options);
    }
    return this.staticSource.getProviders(category, options);
  }

  async getProvider(id: string): Promise<Provider | null> {
    // Try Supabase first (conveyancer UUIDs), fall back to static
    const fromSupabase = await this.supabaseSource.getProvider(id);
    if (fromSupabase) return fromSupabase;
    return this.staticSource.getProvider(id);
  }
}
