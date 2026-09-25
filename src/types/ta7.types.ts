// TA7 Leasehold Information Form - TypeScript Types
// Law Society standard form for leasehold properties
// Fully editable, conditional rendering (only for leasehold)

import { Principal } from '@propxchain/core-client';

export interface TA7LeaseholdInformation {
  // Lease details
  leaseTermYears: number;
  leaseStartDate: string; // ISO date
  leaseExpiryDate: string; // ISO date
  groundRentAmount: number;
  groundRentPaymentFrequency: 'annual' | 'quarterly' | 'monthly' | '';
  serviceChargeAmount: number;
  serviceChargePaymentFrequency: 'annual' | 'quarterly' | 'monthly' | '';

  // Parties
  freeholder: string; // Name/company of freeholder
  managingAgent: string | null;

  // Restrictions
  restrictions: string; // Free text describing any restrictions
  alterationsAllowed: boolean;
  sublettingAllowed: boolean;
  petsAllowed: boolean;

  // Metadata
  completedBy: Principal;
  completedAt: string | null; // ISO timestamp
  lastModifiedBy: Principal;
  lastModifiedAt: string; // ISO timestamp
}

// Empty TA7 form template
export const emptyTA7Form: TA7LeaseholdInformation = {
  leaseTermYears: 0,
  leaseStartDate: '',
  leaseExpiryDate: '',
  groundRentAmount: 0,
  groundRentPaymentFrequency: '',
  serviceChargeAmount: 0,
  serviceChargePaymentFrequency: '',
  freeholder: '',
  managingAgent: null,
  restrictions: '',
  alterationsAllowed: false,
  sublettingAllowed: false,
  petsAllowed: false,
  completedBy: Principal.anonymous(),
  completedAt: null,
  lastModifiedBy: Principal.anonymous(),
  lastModifiedAt: new Date().toISOString(),
};

// Calculate lease remaining years
export function calculateRemainingLeaseYears(leaseExpiryDate: string): number {
  if (!leaseExpiryDate) return 0;

  const expiry = new Date(leaseExpiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);

  return Math.max(0, Math.floor(diffYears));
}

// Check if lease is short (affects mortgageability)
export function isShortLease(leaseExpiryDate: string): boolean {
  const remainingYears = calculateRemainingLeaseYears(leaseExpiryDate);
  return remainingYears < 80; // Lenders typically require 80+ years
}

// Get lease status message
export function getLeaseStatusMessage(leaseExpiryDate: string): {
  status: 'good' | 'warning' | 'critical';
  message: string;
} {
  const remainingYears = calculateRemainingLeaseYears(leaseExpiryDate);

  if (remainingYears >= 80) {
    return {
      status: 'good',
      message: `${remainingYears} years remaining - good for mortgage eligibility`,
    };
  } else if (remainingYears >= 60) {
    return {
      status: 'warning',
      message: `${remainingYears} years remaining - may affect some lenders, consider lease extension`,
    };
  } else {
    return {
      status: 'critical',
      message: `${remainingYears} years remaining - short lease, likely to affect buyer mortgage. Lease extension strongly recommended.`,
    };
  }
}

// Calculate completion percentage
export function calculateTA7Completion(data: TA7LeaseholdInformation): {
  completedFields: number;
  totalFields: number;
  percentage: number;
} {
  let completed = 0;
  const total = 10; // Total required fields

  if (data.leaseTermYears > 0) completed++;
  if (data.leaseStartDate) completed++;
  if (data.leaseExpiryDate) completed++;
  if (data.groundRentAmount >= 0) completed++; // Can be 0
  if (data.groundRentPaymentFrequency) completed++;
  if (data.serviceChargeAmount >= 0) completed++; // Can be 0
  if (data.serviceChargePaymentFrequency) completed++;
  if (data.freeholder) completed++;
  if (data.restrictions) completed++;
  // Booleans always count as completed (default false is valid)
  completed++; // alterationsAllowed/sublettingAllowed/petsAllowed

  return {
    completedFields: completed,
    totalFields: total,
    percentage: Math.round((completed / total) * 100),
  };
}
