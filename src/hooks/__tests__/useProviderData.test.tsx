import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode, ReactElement } from 'react';
import { useProviderData, ProviderDataSourceProvider } from '../useProviderData';
import type {
  ProviderCategory,
  ProviderDataSource,
  ProviderDataSourceOptions,
} from '../../services/providerDataSource';
import type { Provider } from '../../components/providers/types';

interface Setup {
  getProviders: ReturnType<typeof vi.fn>;
  wrapper: ({ children }: { children: ReactNode }) => ReactElement;
}

function setup(): Setup {
  const getProviders = vi.fn(
    async (_category: ProviderCategory, _options?: ProviderDataSourceOptions): Promise<Provider[]> => [],
  );
  const source: ProviderDataSource = {
    getProviders,
    getProvider: async (): Promise<Provider | null> => null,
  };
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ProviderDataSourceProvider value={source}>{children}</ProviderDataSourceProvider>
  );
  return { getProviders, wrapper };
}

describe('useProviderData filterIds refetch stability', () => {
  it('should not refetch for a new-but-equal filterIds array, but refetch when contents change', async () => {
    const { getProviders, wrapper } = setup();

    const { result, rerender } = renderHook(
      ({ filterIds }: { filterIds: string[] }) => useProviderData('conveyancer', { filterIds }),
      { initialProps: { filterIds: ['a', 'b'] }, wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getProviders).toHaveBeenCalledTimes(1);

    // NEW array instance, identical contents — the filterKey join must
    // absorb this so the useCallback dep doesn't retrigger the fetch.
    rerender({ filterIds: ['a', 'b'] });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getProviders).toHaveBeenCalledTimes(1);

    // Contents actually change — a second fetch must fire.
    rerender({ filterIds: ['a', 'c'] });
    await waitFor(() => expect(getProviders).toHaveBeenCalledTimes(2));
    expect(getProviders).toHaveBeenLastCalledWith('conveyancer', {
      postcode: undefined,
      sortBy: undefined,
      filterIds: ['a', 'c'],
    });
  });
});

describe('useProviderData enabled gate', () => {
  it('should not fetch while enabled is false, then fetch once when enabled flips true', async () => {
    const { getProviders, wrapper } = setup();

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useProviderData('conveyancer', { enabled }),
      { initialProps: { enabled: false }, wrapper },
    );

    // Let any pending microtasks settle — no fetch may have fired, and the
    // hook must sit in its initial "waiting" state (isLoading true).
    await Promise.resolve();
    expect(getProviders).toHaveBeenCalledTimes(0);
    expect(result.current.isLoading).toBe(true);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getProviders).toHaveBeenCalledTimes(1);
  });
});
