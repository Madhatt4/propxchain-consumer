// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// Property Search Types for UK Property Conveyancing

export type SearchCategory = 'essential' | 'location-specific' | 'optional';
export type SearchStatus = 'pending' | 'uploaded' | 'verified' | 'expired';
export type SignOffRole = 'solicitor' | 'conveyancer';

/**
 * Search Type Definition
 * Represents metadata about a type of property search
 */
export interface SearchType {
  id: string;
  name: string;
  category: SearchCategory;
  description: string;
  typicalTurnaround: string;
  validityPeriod: number; // Days the search is valid for
  estimatedCost?: string;
  applicableRegions?: string[]; // For location-specific searches
  icon?: string; // Icon identifier
}

/**
 * Property Search Record
 * Represents an uploaded search document for a transaction
 */
export interface PropertySearch {
  id: string;
  transactionId: string;
  searchType: string; // Matches SearchType.id
  status: SearchStatus;
  documentHash?: string; // SHA-256 hash stored on-chain
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  searchDate?: string; // When the search was conducted (ISO date)
  uploadedAt?: string; // When uploaded to system (ISO date)
  uploadedBy?: string; // Principal ID
  uploaderRole?: string; // User role at time of upload
  provider?: string; // Search provider name (e.g., "TM Group", "SearchFlow")
  expiresAt?: string; // Calculated from searchDate + validity period (ISO date)
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
  storageDocumentId?: number; // ICP document_storage canister ID
  verificationDocumentId?: number; // ICP document_verification canister ID
}

/**
 * Search Sign-Off Record
 * Represents professional confirmation that all necessary searches are complete
 */
export interface SearchSignOff {
  id: string;
  transactionId: string;
  signedOffBy: string; // Principal ID
  signedOffByName?: string; // Display name
  signedOffByRole: SignOffRole;
  signedOffAt: string; // ISO date
  searchesIncluded: string[]; // Array of PropertySearch IDs at time of sign-off
  searchCount: number; // Count of searches at sign-off
  notes?: string; // Any caveats or explanations
  isActive: boolean; // False if revoked
  revokedAt?: string;
  revokedBy?: string;
  revokedByName?: string;
  revocationReason?: string;
}

/**
 * Searches Progress Summary
 * Used for progress bar calculation and display
 */
export interface SearchesProgress {
  hasAnySearches: boolean;
  uploadedCount: number;
  essentialSearchesUploaded: number;
  essentialSearchesTotal: number;
  verifiedCount: number;
  expiredCount: number;
  isSignedOff: boolean;
  signOff?: SearchSignOff;
  progressPercentage: number;
  statusLabel: string;
}

/**
 * Search Upload Form Data
 */
export interface SearchUploadData {
  searchType: string;
  file: File;
  searchDate: string;
  provider?: string;
  notes?: string;
}

/**
 * Search Filter Options
 */
export interface SearchFilterOptions {
  category?: SearchCategory | 'all';
  status?: SearchStatus | 'all';
  searchText?: string;
}

/**
 * Search Sign-Off Form Data
 */
export interface SignOffFormData {
  confirmed: boolean;
  notes?: string;
}

/**
 * Search Revocation Form Data
 */
export interface RevocationFormData {
  reason: string;
}
