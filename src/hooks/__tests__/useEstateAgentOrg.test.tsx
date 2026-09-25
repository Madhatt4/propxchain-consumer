import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrganisationMembership } from '@/router/decideRoute';

vi.mock('@/stores/authStore', () => ({
  useAuthStore: <T,>(sel: (s: { supabaseUser: { id: string } }) => T): T => sel({ supabaseUser: { id: 'u1' } }),
}));
let memberships: OrganisationMembership[] = [];
let loading = false;
vi.mock('@/router/useMembershipsQuery', () => ({
  useMembershipsQuery: () => ({ data: memberships, isLoading: loading, isError: false }),
}));

let organisationName: string | null = 'Acme Homes';
const single = vi.fn(() => Promise.resolve({ data: { name: organisationName }, error: null }));
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn((_table: string) => ({ select }));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => from(table) },
}));

import { useEstateAgentOrg } from '../useEstateAgentOrg';

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useEstateAgentOrg', () => {
  it('returns the agent organisation id when present', () => {
    memberships = [
      { organisationId: 'dev', organisationType: 'developer', role: 'admin' },
      { organisationId: 'ag', organisationType: 'agent', role: 'admin' },
    ];
    expect(renderHook(() => useEstateAgentOrg(), { wrapper }).result.current.organisationId).toBe('ag');
  });

  it('returns null when the user has no agent membership', () => {
    memberships = [{ organisationId: 'dev', organisationType: 'developer', role: 'admin' }];
    expect(renderHook(() => useEstateAgentOrg(), { wrapper }).result.current.organisationId).toBeNull();
  });

  it('surfaces loading', () => {
    loading = true; memberships = [];
    expect(renderHook(() => useEstateAgentOrg(), { wrapper }).result.current.isLoading).toBe(true);
  });

  it('resolves the organisation name once an organisation id is present', async () => {
    loading = false;
    organisationName = 'Acme Homes';
    memberships = [{ organisationId: 'ag', organisationType: 'agent', role: 'admin' }];
    const { result } = renderHook(() => useEstateAgentOrg(), { wrapper });
    await waitFor(() => expect(result.current.organisationName).toBe('Acme Homes'));
    expect(from).toHaveBeenCalledWith('organisations');
  });

  it('does not query for the organisation name when there is no organisation id', () => {
    loading = false;
    memberships = [];
    from.mockClear();
    renderHook(() => useEstateAgentOrg(), { wrapper });
    expect(from).not.toHaveBeenCalled();
  });
});
