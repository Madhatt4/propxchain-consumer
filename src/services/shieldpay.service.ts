// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { FEATURE_FLAGS } from '../config/features';
import { logger } from '@/utils/logger';
import type { KycVerification, KycSubmission, KycInitResult, KycDocumentType } from '../types/kyc.types';

const WORKER_URL = import.meta.env.VITE_SHIELDPAY_WORKER_URL || '';

interface AmlCheckParams {
  principalId: string;
  name: string;
  transactionId?: string;
}

interface AmlCheckResult {
  success: boolean;
  verificationId?: string;
  status?: 'pending' | 'passed' | 'failed';
  mock?: boolean;
  error?: string;
}

interface HoldResult {
  success: boolean;
  holdId?: string;
  mock?: boolean;
  error?: string;
}

interface DisburseResult {
  success: boolean;
  mock?: boolean;
  error?: string;
}

async function checkAml(params: AmlCheckParams): Promise<AmlCheckResult> {
  if (!FEATURE_FLAGS.SHIELDPAY_ENABLED || !WORKER_URL) {
    return {
      success: true,
      verificationId: 'mock-aml-001',
      status: 'pending',
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'AML check failed' };
    }

    return {
      success: true,
      verificationId: data.verificationId,
      status: data.status,
    };
  } catch (err) {
    logger.error('Shieldpay checkAml error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function getAmlStatus(verificationId: string): Promise<AmlCheckResult> {
  if (!FEATURE_FLAGS.SHIELDPAY_ENABLED || !WORKER_URL) {
    return {
      success: true,
      verificationId,
      status: 'passed',
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/verify/${encodeURIComponent(verificationId)}`);
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Status check failed' };
    }

    return {
      success: true,
      verificationId: data.verificationId,
      status: data.status,
    };
  } catch (err) {
    logger.error('Shieldpay getAmlStatus error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function createHold(transactionId: string, amountPence: number): Promise<HoldResult> {
  if (!FEATURE_FLAGS.SHIELDPAY_ENABLED || !WORKER_URL) {
    return {
      success: true,
      holdId: 'mock-hold-001',
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, amountPence }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Hold creation failed' };
    }

    return { success: true, holdId: data.holdId };
  } catch (err) {
    logger.error('Shieldpay createHold error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function disburse(holdId: string): Promise<DisburseResult> {
  if (!FEATURE_FLAGS.SHIELDPAY_ENABLED || !WORKER_URL) {
    return { success: true, mock: true };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdId }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'Disburse failed' };
    }

    return { success: true };
  } catch (err) {
    logger.error('Shieldpay disburse error:', err);
    return { success: false, error: 'Network error' };
  }
}

// --- KYC Verification ---

const KYC_STORAGE_PREFIX = 'propx_kyc_';

function getKycStorageKey(principalId: string): string {
  return `${KYC_STORAGE_PREFIX}${principalId}`;
}

function storeKycVerification(principalId: string, verification: KycVerification): void {
  sessionStorage.setItem(getKycStorageKey(principalId), JSON.stringify(verification));
}

function getStoredKycVerification(principalId: string): KycVerification | null {
  const stored = sessionStorage.getItem(getKycStorageKey(principalId));
  if (!stored) return null;

  try {
    const verification = JSON.parse(stored) as KycVerification;
    if (verification.expiresAt && new Date(verification.expiresAt) < new Date()) {
      return { ...verification, status: 'expired' };
    }
    return verification;
  } catch {
    return null;
  }
}

async function initiateKyc(submission: KycSubmission): Promise<KycInitResult> {
  if (!FEATURE_FLAGS.SHIELDPAY_ENABLED || !WORKER_URL) {
    const verificationId = `mock-kyc-${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    const verification: KycVerification = {
      status: 'verified',
      provider: 'mock',
      verificationId,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      documentsVerified: ['proofOfIdentity', 'proofOfAddress'],
      fullName: submission.personalDetails.fullName,
      dateOfBirth: submission.personalDetails.dateOfBirth,
    };

    storeKycVerification(submission.principalId, verification);

    return {
      success: true,
      verificationId,
      status: 'verified',
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/kyc/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    const data = await resp.json();

    if (!resp.ok) {
      return { success: false, error: data.error || 'KYC initiation failed' };
    }

    if (data.status === 'verified') {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);

      const verification: KycVerification = {
        status: data.status,
        provider: 'shieldpay',
        verificationId: data.verificationId,
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        documentsVerified: ['proofOfIdentity', 'proofOfAddress'],
        fullName: submission.personalDetails.fullName,
        dateOfBirth: submission.personalDetails.dateOfBirth,
      };
      storeKycVerification(submission.principalId, verification);
    }

    return {
      success: true,
      verificationId: data.verificationId,
      status: data.status,
    };
  } catch (err) {
    logger.error('ShieldPay initiateKyc error:', err);
    return { success: false, error: 'Network error' };
  }
}

function getKycStatus(principalId: string): KycVerification | null {
  return getStoredKycVerification(principalId);
}

function isDocumentSatisfiedByKyc(principalId: string, documentStorageKey: string): boolean {
  const kyc = getStoredKycVerification(principalId);
  if (!kyc || kyc.status !== 'verified') return false;
  return kyc.documentsVerified.includes(documentStorageKey as KycDocumentType);
}

export const shieldpayService = {
  checkAml,
  getAmlStatus,
  createHold,
  disburse,
  initiateKyc,
  getKycStatus,
  isDocumentSatisfiedByKyc,
  storeKycVerification,
};
