// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Land Registry Integration Types
 * Expanded types for UK Land Registry integration with requisition tracking,
 * official searches, and cost management.
 */

// Land Registry status - 16 total statuses grouped by phase
export type LandRegistryStatus =
  // Pre-submission
  | 'not_initiated'
  | 'pending_official_search'
  | 'official_search_completed'
  | 'official_search_expired'
  // Submission
  | 'pending_submission'
  | 'pre_validation_failed'
  | 'submitted'
  | 'queued_manual_processing'
  // Processing
  | 'application_received'
  | 'under_examination'
  | 'requisition_raised'
  | 'requisition_responded'
  // Completion
  | 'registered'
  | 'completed_with_notes'
  // Failure
  | 'rejected'
  | 'cancelled'
  | 'failed';

/**
 * Requisition raised by Land Registry during application processing
 */
export interface Requisition {
  requisitionId: string;
  raisedAt: bigint;
  description: string;
  category: string;
  respondedAt: bigint | null;
  responseText: string | null;
  resolvedAt: bigint | null;
  isResolved: boolean;
}

/**
 * Full Land Registry Integration data structure
 * All new fields are optional with safe defaults
 */
export interface LandRegistryIntegration {
  status: LandRegistryStatus;

  // Official Search (OS1)
  officialSearchRequestedAt: bigint | null;
  officialSearchCompletedAt: bigint | null;
  officialSearchPriorityExpiry: bigint | null;
  officialSearchCertificateRef: string | null;
  registerChangedSinceSearch: boolean | null;
  advisoryEntries: string[];

  // Application Submission
  submittedToLRAt: bigint | null;
  applicationReference: string | null;
  landRegistryConfirmationNumber: string | null;
  submissionResponseCode: number | null;
  preValidationErrors: string[];

  // Processing
  estimatedCompletionDate: string | null;
  estimatedLRCompletionTime: bigint | null;
  caseworkerAssigned: boolean | null;
  lastPolledAt: bigint | null;
  pollCount: number;

  // Requisitions
  requisitions: Requisition[];

  // Completion
  registeredAt: bigint | null;
  newTitleNumber: string | null;
  registrationNotes: string[];

  // Cost Tracking (in pence)
  officialSearchCost: number;
  applicationFee: number;
  totalLRCosts: number;

  // Metadata
  lrPayloadID: string | null;
  lastUpdated: bigint;
}

/**
 * Default empty Land Registry Integration
 * Used for transactions created before migration
 */
export const DEFAULT_LAND_REGISTRY_INTEGRATION: LandRegistryIntegration = {
  status: 'not_initiated',
  officialSearchRequestedAt: null,
  officialSearchCompletedAt: null,
  officialSearchPriorityExpiry: null,
  officialSearchCertificateRef: null,
  registerChangedSinceSearch: null,
  advisoryEntries: [],
  submittedToLRAt: null,
  applicationReference: null,
  landRegistryConfirmationNumber: null,
  submissionResponseCode: null,
  preValidationErrors: [],
  estimatedCompletionDate: null,
  estimatedLRCompletionTime: null,
  caseworkerAssigned: null,
  lastPolledAt: null,
  pollCount: 0,
  requisitions: [],
  registeredAt: null,
  newTitleNumber: null,
  registrationNotes: [],
  officialSearchCost: 0,
  applicationFee: 0,
  totalLRCosts: 0,
  lrPayloadID: null,
  lastUpdated: BigInt(0),
};
