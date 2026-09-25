// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { QueryClient } from '@tanstack/react-query';

// Default stale time (data considered fresh for this duration)
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// Default cache time (data kept in cache for this duration)
const DEFAULT_CACHE_TIME = 30 * 60 * 1000; // 30 minutes

// Create and configure QueryClient
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data stays fresh before refetching
      staleTime: DEFAULT_STALE_TIME,

      // How long data stays in cache after component unmounts
      gcTime: DEFAULT_CACHE_TIME,

      // Retry failed requests up to 3 times
      retry: 3,

      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Don't refetch on window focus by default (can be overridden per query)
      refetchOnWindowFocus: false,

      // Don't refetch on reconnect by default
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

// Query key factory for type-safe query keys
export const queryKeys = {
  // Auth related queries
  auth: {
    all: ['auth'] as const,
    profile: () => [...queryKeys.auth.all, 'profile'] as const,
  },

  // Transaction related queries
  transactions: {
    all: ['transactions'] as const,
    list: () => [...queryKeys.transactions.all, 'list'] as const,
    myList: () => [...queryKeys.transactions.all, 'my-list'] as const,
    detail: (id: string) => [...queryKeys.transactions.all, 'detail', id] as const,
    byInviteCode: (code: string) => [...queryKeys.transactions.all, 'invite', code] as const,
  },

  // Property related queries
  properties: {
    all: ['properties'] as const,
    list: () => [...queryKeys.properties.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.properties.all, 'detail', id] as const,
  },

  // Document related queries
  documents: {
    all: ['documents'] as const,
    list: () => [...queryKeys.documents.all, 'list'] as const,
    byTransaction: (txId: string) => [...queryKeys.documents.all, 'transaction', txId] as const,
    detail: (id: string) => [...queryKeys.documents.all, 'detail', id] as const,
    proof: (id: string) => [...queryKeys.documents.all, 'proof', id] as const,
  },

  // User related queries
  users: {
    all: ['users'] as const,
    profile: (principal: string) => [...queryKeys.users.all, 'profile', principal] as const,
  },

  // Ledger related queries
  ledger: {
    all: ['ledger'] as const,
    userLedger: (accountId: string) => [...queryKeys.ledger.all, 'user', accountId] as const,
    analytics: (accountId: string, period: string) => [...queryKeys.ledger.all, 'analytics', accountId, period] as const,
    efficiency: (accountId: string) => [...queryKeys.ledger.all, 'efficiency', accountId] as const,
  },

  // Subscription related queries
  subscription: {
    all: ['subscription'] as const,
    info: () => [...queryKeys.subscription.all, 'info'] as const,
  },

  // AI scan related queries (hmlr / search / survey)
  scans: {
    all: ['scans'] as const,
    hmlr: (transactionId: string) => [...queryKeys.scans.all, 'hmlr', transactionId] as const,
    search: (sourceRef: string) => [...queryKeys.scans.all, 'search', sourceRef] as const,
    survey: (sourceRef: string) => [...queryKeys.scans.all, 'survey', sourceRef] as const,
  },

  // Admin dashboard queries
  admin: {
    all: ['admin'] as const,
    summary: () => [...queryKeys.admin.all, 'summary'] as const,
    transactions: () => [...queryKeys.admin.all, 'transactions'] as const,
    users: () => [...queryKeys.admin.all, 'users'] as const,
    canisters: () => [...queryKeys.admin.all, 'canisters'] as const,
    landRegistry: () => [...queryKeys.admin.all, 'land-registry'] as const,
    budget: () => [...queryKeys.admin.all, 'budget'] as const,
    emails: () => [...queryKeys.admin.all, 'emails'] as const,
    documents: () => [...queryKeys.admin.all, 'documents'] as const,
    properties: () => [...queryKeys.admin.all, 'properties'] as const,
    messages: () => [...queryKeys.admin.all, 'messages'] as const,
  },
};

// Helper to invalidate all queries
export const invalidateAllQueries = () => {
  queryClient.invalidateQueries();
};

// Helper to invalidate transaction queries
export const invalidateTransactionQueries = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
};

// Helper to invalidate document queries
export const invalidateDocumentQueries = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
};

// Helper to invalidate all admin dashboard queries (the Refresh button)
export const invalidateAdminQueries = (): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });

// Helper to prefetch transaction detail
export const prefetchTransaction = async (id: string, fetchFn: () => Promise<any>) => {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.transactions.detail(id),
    queryFn: fetchFn,
    staleTime: DEFAULT_STALE_TIME,
  });
};
