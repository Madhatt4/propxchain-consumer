import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { Provider } from '../components/providers/types';
import type {
  ProviderCategory,
  ProviderDataSource,
  ProviderDataSourceOptions,
} from '../services/providerDataSource';
import { HybridProviderDataSource } from '../services/providerDataSource';

// Context for DI — testable, swappable
const ProviderDataSourceContext = createContext<ProviderDataSource>(
  new HybridProviderDataSource(),
);

export const ProviderDataSourceProvider = ProviderDataSourceContext.Provider;

interface UseProviderDataReturn {
  providers: Provider[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProviderData(
  category: ProviderCategory,
  options?: ProviderDataSourceOptions & { enabled?: boolean },
): UseProviderDataReturn {
  const dataSource = useContext(ProviderDataSourceContext);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // While disabled, no fetch fires and isLoading stays at its initial true —
  // callers render the loading skeleton as the correct "waiting" UI.
  const enabled = options?.enabled ?? true;
  const postcode = options?.postcode;
  const sortBy = options?.sortBy;
  // Join to a string so a new-but-equal array doesn't retrigger the fetch
  // (callers may rebuild the array each render). undefined = no filter.
  const filterKey = options?.filterIds ? options.filterIds.join(',') : undefined;

  const fetchProviders = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const filterIds =
        filterKey === undefined ? undefined : filterKey === '' ? [] : filterKey.split(',');
      const result = await dataSource.getProviders(category, { postcode, sortBy, filterIds });
      setProviders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  }, [dataSource, category, postcode, sortBy, filterKey]);

  useEffect(() => {
    if (!enabled) return;
    void fetchProviders();
  }, [fetchProviders, enabled]);

  return { providers, isLoading, error, refetch: fetchProviders };
}
