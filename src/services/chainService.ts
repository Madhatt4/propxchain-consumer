// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * View My Chain (VMC) chain-status service.
 *
 * VMC requires mTLS + a Raidiam bearer token, which cannot run in the browser,
 * so production calls go through our server-side proxy (mirrors hmlr-proxy-render).
 * Set VITE_VMC_PROXY_URL to the proxy base. With no proxy configured we return a
 * bundled sandbox sample so the Chain tab renders in dev.
 *
 * The proxy answers only a signed-in party to the transaction, and only for the
 * property the transaction's first successful lookup locked (security scan H10),
 * so every call carries the Supabase access token.
 */
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export type ChainType = 'IN_CHAIN' | 'SPLIT_CHAIN' | 'NOT_IN_CHAIN';

export interface ChainMilestone {
  label: string;
  date: string;
}

export interface ChainParticipants {
  sellingAgent?: string;
  sellerConveyancer?: string;
  buyerConveyancer?: string;
}

export interface ChainProperty {
  id: number;
  uprn: number;
  displayAddress: string;
  postcode?: string;
  tenure?: string;
  transactionType: string[];
  milestones: ChainMilestone[];
  participants?: ChainParticipants;
  connections: { upwardChain: number[]; downwardChain: number[] };
}

export interface PropertyChain {
  chainId: string;
  chainType: ChainType;
  chainLength: number;
  queriedAddress: string;
  properties: ChainProperty[];
}

export interface ChainResult {
  status: 'in_chain' | 'not_in_chain';
  chain: PropertyChain | null;
  provenance?: { alg: string; signedAt: string };
}

export interface ChainQuery {
  uprn?: string;
  address?: string;
  transactionId?: string;
}

/**
 * Bundled sandbox sample (VMC test UPRN 38192980) for dev when no proxy is set.
 * Agent and conveyancer names are synthetic; the sandbox response named real firms.
 */
const SANDBOX_SAMPLE: ChainResult = {
  status: 'in_chain',
  chain: {
    chainId: 'F9000B97-CEE0-49BC-B482-952EC0C6B7A3',
    chainType: 'SPLIT_CHAIN',
    chainLength: 4,
    queriedAddress: '1 COBBLESTONE CORNER, LIVERPOOL, L19 9ES',
    properties: [
      { id: 27516226, uprn: 100021200034, displayAddress: '73 MANOR ROAD, TOTTENHAM, LONDON, N17 0JH', transactionType: [], milestones: [{ label: 'SSTC', date: '2026-04-28' }], participants: { sellingAgent: 'Sample Estates', sellerConveyancer: 'Example Conveyancing LLP', buyerConveyancer: 'Sample Law Ltd' }, connections: { upwardChain: [], downwardChain: [27516223] } },
      { id: 27516223, uprn: 38192980, displayAddress: '1 COBBLESTONE CORNER, LIVERPOOL, L19 9ES', postcode: 'L19 9ES', tenure: 'commonhold', transactionType: ['probate', 'freehold_enfranchisement'], milestones: [{ label: 'SSTC', date: '2025-12-06' }, { label: 'Searches Ordered', date: '2026-05-03' }, { label: 'Search Delivered', date: '2026-05-01' }, { label: 'Cash Buyer', date: '2026-05-04' }], participants: { sellingAgent: 'Example Homes', sellerConveyancer: 'Demo Solicitors', buyerConveyancer: 'Example Conveyancing LLP' }, connections: { upwardChain: [27516226], downwardChain: [27516224, 27516225] } },
      { id: 27516224, uprn: 30016442, displayAddress: '11 ADBER CLOSE, YEOVIL, BA21 5XJ', transactionType: [], milestones: [{ label: 'SSTC', date: '2026-04-15' }, { label: 'Searches Ordered', date: '2026-04-28' }, { label: 'Search Delivered', date: '2026-04-28' }, { label: 'Mortgage Applied', date: '2026-05-02' }, { label: 'Exchange', date: '2026-05-04' }], participants: { sellingAgent: 'Demo Property Co', sellerConveyancer: 'Test & Partners', buyerConveyancer: 'Specimen Law LLP' }, connections: { upwardChain: [27516223], downwardChain: [] } },
      { id: 27516225, uprn: 25101892, displayAddress: '54 MOORGATE, LEADENHALL, MILTON KEYNES, MK6 5NA', transactionType: [], milestones: [{ label: 'SSTC', date: '2026-04-29' }], participants: { sellingAgent: 'Placeholder Lettings & Sales', sellerConveyancer: 'Placeholder Legal', buyerConveyancer: 'Demo Solicitors' }, connections: { upwardChain: [27516223], downwardChain: [] } },
    ],
  },
  provenance: { alg: 'RS256', signedAt: '2026-06-09T10:43:35Z' },
};

/** Fetch chain status for a property. Falls back to the sandbox sample in dev. */
export async function getChain(query: ChainQuery): Promise<ChainResult> {
  // Read at call time (not hoisted to a module-level constant) so it reflects
  // the environment at call time rather than at first import — this also
  // makes the proxy branch independently testable via `vi.stubEnv` per-test
  // (see src/services/chainEntitlement.service.ts for the same pattern).
  const proxyUrl: string | undefined = import.meta.env.VITE_VMC_PROXY_URL;
  if (!proxyUrl) {
    logger.warn('[chainService] VITE_VMC_PROXY_URL not set — returning sandbox sample');
    return SANDBOX_SAMPLE;
  }
  const params = new URLSearchParams();
  if (query.uprn) params.set('uprn', query.uprn);
  else if (query.address) params.set('address', query.address);
  if (query.transactionId) params.set('txId', query.transactionId);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${proxyUrl}/chains?${params.toString()}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`VMC proxy ${res.status}`);
  }
  return (await res.json()) as ChainResult;
}
