// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

let currentUserId: string | null = 'u-client';
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { supabaseUser: { id: string } | null }) => unknown) => selector({ supabaseUser: currentUserId ? { id: currentUserId } : null }),
}));
let currentOrg: string | null = null;
vi.mock('@/hooks/useEstateAgentOrg', () => ({ useEstateAgentOrg: () => ({ organisationId: currentOrg, isLoading: false }) }));
const mockList = vi.fn();
const mockStatus = vi.fn();
vi.mock('@/services/delegation.service', () => ({
  listDelegations: (...args: unknown[]) => mockList(...args),
  loadDelegationStatus: (...args: unknown[]) => mockStatus(...args),
}));

import { useMandate } from '../useMandate';

const row = (over: Record<string, unknown>) => ({
  id: 'd1', transactionId: 'tx_1', role: 'seller', state: 'active', requestedAt: 'x', grantedAt: 'y', revokedAt: null,
  granteeOrgId: 'org-a', grantorUserId: 'u-client', ...over,
});

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMandate', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockStatus.mockReset().mockResolvedValue({ agencyName: 'Smith & Co' });
    currentUserId = 'u-client';
    currentOrg = null;
  });

  it('an agency member sees the side their agency acts for', async () => {
    currentOrg = 'org-a';
    currentUserId = 'u-agent';
    mockList.mockResolvedValue([row({})]);
    const { result } = renderHook(() => useMandate('tx_1', 'seller'), { wrapper });
    await waitFor(() => expect(result.current.actingFor).toEqual(['seller']));
    expect(result.current.grantedByMe).toBeNull();
  });

  it('an agency acting for both sides sees both, once each', async () => {
    currentOrg = 'org-a';
    currentUserId = 'u-agent';
    mockList.mockResolvedValue([row({}), row({ id: 'd2', role: 'buyer', grantorUserId: 'u-buyer' }), row({ id: 'd0', state: 'revoked' })]);
    const { result } = renderHook(() => useMandate('tx_1', 'seller'), { wrapper });
    await waitFor(() => expect(result.current.actingFor).toEqual(['seller', 'buyer']));
  });

  it('a client sees the mandate they granted for their own role, with the agency name from the platform', async () => {
    mockList.mockResolvedValue([row({})]);
    const { result } = renderHook(() => useMandate('tx_1', 'seller'), { wrapper });
    await waitFor(() => expect(result.current.grantedByMe?.id).toBe('d1'));
    await waitFor(() => expect(result.current.agencyName).toBe('Smith & Co'));
    expect(result.current.actingFor).toEqual([]);
    expect(mockStatus).toHaveBeenCalledWith('d1');
  });

  it('a revoked mandate, another role, or another agency count for nothing', async () => {
    currentOrg = 'org-b';
    mockList.mockResolvedValue([row({ state: 'revoked' }), row({ id: 'd2', role: 'buyer' }), row({ id: 'd3', grantorUserId: 'someone-else' })]);
    const { result } = renderHook(() => useMandate('tx_1', 'seller'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.actingFor).toEqual([]);
    expect(result.current.grantedByMe).toBeNull();
  });
});
