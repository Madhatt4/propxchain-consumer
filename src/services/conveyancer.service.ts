// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { FEATURE_FLAGS } from '../config/features';
import { logger } from '@/utils/logger';

const WORKER_URL = import.meta.env.VITE_CONVEYANCER_WORKER_URL || '';

export interface ConveyancerFirm {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number;
  cqsAccredited: boolean;
}

interface FirmsResult {
  success: boolean;
  firms?: ConveyancerFirm[];
  mock?: boolean;
  error?: string;
}

interface FirmDetailResult {
  success: boolean;
  firm?: ConveyancerFirm;
  mock?: boolean;
  error?: string;
}

interface InstructResult {
  success: boolean;
  matterRef?: string;
  mock?: boolean;
  error?: string;
}

interface MatterStatusResult {
  success: boolean;
  status?: string;
  lastUpdated?: string;
  mock?: boolean;
  error?: string;
}

const MOCK_FIRMS: ConveyancerFirm[] = [
  {
    id: 'mock-firm-001',
    name: 'Ashton Brooke Solicitors',
    address: '14 High Street, Bedford MK40 1NN',
    phone: '01234 567890',
    rating: 4.7,
    cqsAccredited: true,
  },
  {
    id: 'mock-firm-002',
    name: 'Greenfield & Partners LLP',
    address: '22 Castle Lane, Sandy SG19 1AA',
    phone: '01767 123456',
    rating: 4.3,
    cqsAccredited: false,
  },
];

async function searchFirms(
  postcode: string,
  transactionType: string
): Promise<FirmsResult> {
  if (!FEATURE_FLAGS.CONVEYANCER_PANEL_ENABLED || !WORKER_URL) {
    return { success: true, firms: MOCK_FIRMS, mock: true };
  }

  try {
    const params = new URLSearchParams({ postcode, type: transactionType });
    const resp = await fetch(`${WORKER_URL}/firms?${params.toString()}`);
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Search failed' };
    }

    return { success: true, firms: data.firms || data };
  } catch (err) {
    logger.error('Conveyancer searchFirms error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function getFirmDetails(firmId: string): Promise<FirmDetailResult> {
  if (!FEATURE_FLAGS.CONVEYANCER_PANEL_ENABLED || !WORKER_URL) {
    const firm = MOCK_FIRMS.find(f => f.id === firmId);
    return { success: true, firm: firm || MOCK_FIRMS[0], mock: true };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/firms/${encodeURIComponent(firmId)}`);
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Failed to fetch firm' };
    }

    return { success: true, firm: data };
  } catch (err) {
    logger.error('Conveyancer getFirmDetails error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function instructFirm(
  firmId: string,
  matterDetails: Record<string, unknown>
): Promise<InstructResult> {
  if (!FEATURE_FLAGS.CONVEYANCER_PANEL_ENABLED || !WORKER_URL) {
    return {
      success: true,
      matterRef: 'MOCK-MTR-001',
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/instruct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firmId, ...matterDetails }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Instruction failed' };
    }

    return { success: true, matterRef: data.matterRef };
  } catch (err) {
    logger.error('Conveyancer instructFirm error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function getMatterStatus(matterRef: string): Promise<MatterStatusResult> {
  if (!FEATURE_FLAGS.CONVEYANCER_PANEL_ENABLED || !WORKER_URL) {
    return {
      success: true,
      status: 'instructed',
      lastUpdated: new Date().toISOString(),
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/matter/${encodeURIComponent(matterRef)}`);
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Status check failed' };
    }

    return {
      success: true,
      status: data.status,
      lastUpdated: data.lastUpdated,
    };
  } catch (err) {
    logger.error('Conveyancer getMatterStatus error:', err);
    return { success: false, error: 'Network error' };
  }
}

export const conveyancerService = {
  searchFirms,
  getFirmDetails,
  instructFirm,
  getMatterStatus,
};
