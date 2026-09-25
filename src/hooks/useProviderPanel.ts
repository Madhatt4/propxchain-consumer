import { useState, useCallback } from 'react';

interface UseProviderPanelReturn {
  compareIds: string[];
  isCompareActive: boolean;
  toggleCompare: (providerId: string) => void;
  clearCompare: () => void;
}

const MAX_COMPARE = 2;

export function useProviderPanel(): UseProviderPanelReturn {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = useCallback((providerId: string): void => {
    setCompareIds((prev) => {
      if (prev.includes(providerId)) {
        return prev.filter((id) => id !== providerId);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, providerId];
    });
  }, []);

  const clearCompare = useCallback((): void => {
    setCompareIds([]);
  }, []);

  return {
    compareIds,
    isCompareActive: compareIds.length === MAX_COMPARE,
    toggleCompare,
    clearCompare,
  };
}
