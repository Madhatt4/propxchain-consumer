// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/** KYC verification status */
export type KycStatus = 'not_started' | 'pending' | 'verified' | 'failed' | 'expired';

/** KYC provider identifier */
export type KycProvider = 'shieldpay' | 'mock';

/** Document types that can be satisfied by KYC verification */
export type KycDocumentType = 'proofOfIdentity' | 'proofOfAddress';

/** Stored KYC verification result */
export interface KycVerification {
  status: KycStatus;
  provider: KycProvider;
  verificationId: string;
  verifiedAt: string;
  expiresAt: string;
  documentsVerified: KycDocumentType[];
  fullName: string;
  dateOfBirth: string;
}

/** Data collected during KYC step 1: Personal details */
export interface KycPersonalDetails {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
}

/** Data collected during KYC step 2: ID document */
export interface KycIdDocument {
  documentType: 'passport' | 'driving_licence' | 'national_id';
  fileName: string;
  fileSize: number;
}

/** Data collected during KYC step 3: Address verification */
export interface KycAddressDetails {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  proofType: 'utility_bill' | 'bank_statement' | 'council_tax';
  proofFileName: string;
}

/** Combined KYC submission data */
export interface KycSubmission {
  personalDetails: KycPersonalDetails;
  idDocument: KycIdDocument;
  addressDetails: KycAddressDetails;
  principalId: string;
}

/** Result from ShieldPay KYC initiation */
export interface KycInitResult {
  success: boolean;
  verificationId?: string;
  status?: KycStatus;
  mock?: boolean;
  error?: string;
}
