import { useEffect, useState } from 'react';
import type { Provider } from '../components/providers/types';
import { searchConveyancerPanel } from '../services/conveyancerPanelSearch';

const DEBOUNCE_MS = 250;

interface UseConveyancerSearchReturn {
  results: Provider[];
  isLoading: boolean;
  error: string | null;
  hasQuery: boolean;
}

export function useConveyancerSearch(query: string): UseConveyancerSearchReturn {
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const [results, setResults] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchConveyancerPanel(trimmed);
        if (!cancelled) {
          setResults(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, hasQuery]);

  return { results, isLoading, error, hasQuery };
}
