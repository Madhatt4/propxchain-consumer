// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Subscription Type Definitions
 *
 * Canonical tier scheme (locked 2026-05-17, card d662d062):
 *   starter    — FREE platform access. Pay HMLR/search fees on demand.
 *   premium    — £75 per transaction. Full platform features.
 *
 * The active subscription surface lives in
 * `src/constants/subscriptionFeatures.ts` and `src/hooks/useSubscription.ts`.
 * This file (and the services that import it) is retained for the legacy
 * upgrade-request / pricing-card flow and may be removed in a later sweep.
 */

// Subscription Tiers
export enum SubscriptionTier {
  STARTER = 'starter',
  PREMIUM = 'premium',
}

// Subscription Status
export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

// Payment Method
export enum PaymentMethod {
  STRIPE_CARD = 'stripe_card',
  ICP_TOKEN = 'icp_token',
  MANUAL = 'manual',
}

// Payment Status
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Subscription Information
export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  transactionQuota: number; // Total transactions allowed
  transactionsUsed: number; // Transactions used this period
  transactionsRemaining: number; // Remaining transactions
  pricePerTransaction: number; // Price per transaction in GBP
  validUntil: string | null; // ISO date string (null for pay-per-transaction)
  autoRenew: boolean;
  paymentMethod: PaymentMethod | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Subscription Features
export interface SubscriptionFeatures {
  // Core features
  blockchainVerification: boolean;
  documentStorage: boolean;

  // Support level
  emailSupport: boolean;
  prioritySupport: boolean;
  dedicatedAccountManager: boolean;

  // Access features
  multiUserAccess: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;

  // Transaction limits
  monthlyTransactionLimit: number | null; // null = unlimited
  pricePerTransaction: number; // GBP

  // Additional features
  customIntegration: boolean;
  slaGuarantee: boolean;
}

// Tier Pricing
export interface TierPricing {
  tier: SubscriptionTier;
  name: string;
  description: string;
  pricePerTransaction: number; // GBP
  currency: string; // 'GBP'
  monthlyMinimum: number | null; // Minimum transactions per month (null = no minimum)
  features: SubscriptionFeatures;
  popular?: boolean;
}

// Payment Intent
export interface PaymentIntent {
  id: string;
  tier: SubscriptionTier;
  amount: number; // Amount in GBP
  currency: string; // 'GBP'
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionCount: number; // Number of transactions being purchased
  metadata: {
    principalId: string;
    email: string;
    name: string;
  };
  createdAt: string; // ISO date string
  completedAt?: string; // ISO date string
}

// Upgrade Request
export interface UpgradeRequest {
  fromTier: SubscriptionTier;
  toTier: SubscriptionTier;
  paymentMethod: PaymentMethod;
  transactionCount?: number; // For pay-per-transaction purchases
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ICP Payment Details
export interface ICPPaymentDetails {
  principalId: string;
  amount: number; // Amount in ICP tokens
  treasuryPrincipal: string; // PropXchain treasury principal
  transactionId?: string; // ICP ledger transaction ID
  blockHeight?: bigint; // Block height of payment
  timestamp: string;
}

// Stripe Payment Details
export interface StripePaymentDetails {
  sessionId: string;
  customerId?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
  status: 'pending' | 'succeeded' | 'failed';
}

// Transaction Purchase
export interface TransactionPurchase {
  id: string;
  principalId: string;
  tier: SubscriptionTier;
  transactionCount: number;
  totalAmount: number; // GBP
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDetails: ICPPaymentDetails | StripePaymentDetails | null;
  createdAt: string;
  completedAt?: string;
}

// Feature Access Check
export interface FeatureAccessCheck {
  hasAccess: boolean;
  reason?: string; // Reason if access denied
  upgradeRequired?: SubscriptionTier; // Suggested tier to upgrade to
}

// Tier Feature Matrix (for UI display)
export const TIER_FEATURES: Record<SubscriptionTier, SubscriptionFeatures> = {
  [SubscriptionTier.STARTER]: {
    blockchainVerification: false,
    documentStorage: false,
    emailSupport: false,
    prioritySupport: false,
    dedicatedAccountManager: false,
    multiUserAccess: false,
    advancedAnalytics: false,
    apiAccess: false,
    whiteLabel: false,
    monthlyTransactionLimit: 0,
    pricePerTransaction: 0,
    customIntegration: false,
    slaGuarantee: false,
  },
  [SubscriptionTier.PREMIUM]: {
    blockchainVerification: true,
    documentStorage: true,
    emailSupport: true,
    prioritySupport: true,
    dedicatedAccountManager: false,
    multiUserAccess: true,
    advancedAnalytics: true,
    apiAccess: false,
    whiteLabel: false,
    monthlyTransactionLimit: null,
    pricePerTransaction: 75,
    customIntegration: false,
    slaGuarantee: false,
  },
};

// Public pricing tiers — Starter / Premium / Enterprise.
export const PRICING_TIERS: TierPricing[] = [
  {
    tier: SubscriptionTier.STARTER,
    name: 'Starter',
    description: 'Free platform access. Pay HMLR title and search fees on demand.',
    pricePerTransaction: 0,
    currency: 'GBP',
    monthlyMinimum: null,
    features: TIER_FEATURES[SubscriptionTier.STARTER],
  },
  {
    tier: SubscriptionTier.PREMIUM,
    name: 'Premium',
    description: '£75 per transaction. Full platform features.',
    pricePerTransaction: 75,
    currency: 'GBP',
    monthlyMinimum: null,
    features: TIER_FEATURES[SubscriptionTier.PREMIUM],
    popular: true,
  },
];

/**
 * Feature requirements for specific routes/features
 */
export const FEATURE_REQUIREMENTS = {
  '/dashboard/analytics': { minTier: SubscriptionTier.PREMIUM, featureName: 'Analytics Dashboard' },
  '/dashboard/blockchain-ledger': { minTier: SubscriptionTier.PREMIUM, featureName: 'Blockchain Ledger' },
  'bulk-transactions': { minTier: SubscriptionTier.PREMIUM, featureName: 'Bulk Transaction Creation' },
  'custom-reports': { minTier: SubscriptionTier.PREMIUM, featureName: 'Custom Reports' },
} as const;

/**
 * Tier hierarchy for comparison
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  [SubscriptionTier.STARTER]: 0,
  [SubscriptionTier.PREMIUM]: 1,
};

/**
 * Check if user's tier meets the minimum required tier
 */
export function hasMinimumTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Get user's subscription tier from localStorage or profile.
 *
 * Backward-compat: legacy values ('free' / 'individual' / 'professional' /
 * 'seller') get translated to the canonical scheme on read.
 */
export function getUserSubscriptionTier(): SubscriptionTier {
  const storedTier = localStorage.getItem('subscriptionTier');

  switch ((storedTier || '').toLowerCase()) {
    case 'starter':
    case 'free':
      return SubscriptionTier.STARTER;
    case 'premium':
    case 'individual':
    case 'professional':
    case 'seller':
      return SubscriptionTier.PREMIUM;
    // Retired 2026-08-21 — map to PREMIUM so an existing holder keeps access.
    case 'enterprise':
      return SubscriptionTier.PREMIUM;
    default:
      return SubscriptionTier.STARTER;
  }
}

/**
 * Set user's subscription tier in localStorage
 */
export function setUserSubscriptionTier(tier: SubscriptionTier): void {
  localStorage.setItem('subscriptionTier', tier);
}

/**
 * Check if user has access to a specific feature
 */
export function hasFeatureAccess(featurePath: string): boolean {
  const userTier = getUserSubscriptionTier();
  const requirement = FEATURE_REQUIREMENTS[featurePath as keyof typeof FEATURE_REQUIREMENTS];

  if (!requirement) {
    // Feature not gated, allow access
    return true;
  }

  return hasMinimumTier(userTier, requirement.minTier);
}

/**
 * Get the tier name as a readable string
 */
export function getTierName(tier: SubscriptionTier): string {
  switch (tier) {
    case SubscriptionTier.STARTER:
      return 'Starter';
    case SubscriptionTier.PREMIUM:
      return 'Premium';
    default:
      return 'Starter';
  }
}
