/**
 * Multi-Party Transaction Types
 * Support for N buyers and N sellers (couples, consortiums)
 * with individual AML document tracking per party.
 */

// Role within a transaction (primary vs secondary parties)
export type TransactionPartyRole =
  | 'primary_buyer'
  | 'secondary_buyer'
  | 'primary_seller'
  | 'secondary_seller';

// AML verification status for each party
export type AMLStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'rejected';

// Individual party in a transaction
// Document field names match storageKey values in documentTypes.ts
export interface TransactionParty {
  principal: string;
  role: TransactionPartyRole;
  name: string;
  email: string;
  isPrimary: boolean;
  joinedAt: string | number;
  amlStatus: AMLStatus;
  // AML documents (required for all parties)
  proofOfIdentityUploaded: boolean;
  proofOfAddressUploaded: boolean;
  amlComplete: boolean;
  // Buyer-specific documents
  proofOfFundsUploaded: boolean;
  mortgageAgreementUploaded: boolean;
  // Seller-specific documents (transaction-level, tracked on primary seller)
  titleDeedsUploaded: boolean;
  epcUploaded: boolean;
  ta6FormUploaded: boolean;
  ta10FormUploaded: boolean;
}

// Progress tracking for a side (buyers or sellers)
export interface PartyProgress {
  parties: TransactionParty[];
  totalParties: number;
  completedParties: number;
  overallProgress: number; // 0-100 percentage
  allAMLComplete: boolean;
}

// Combined progress for transaction
export interface TransactionPartyProgress {
  buyers: PartyProgress;
  sellers: PartyProgress;
  readyToExchange: boolean;
}

// Helper functions

/**
 * Check if role is a buyer role
 */
export function isPartyBuyerRole(role: TransactionPartyRole): boolean {
  return role === 'primary_buyer' || role === 'secondary_buyer';
}

/**
 * Check if role is a seller role
 */
export function isPartySellerRole(role: TransactionPartyRole): boolean {
  return role === 'primary_seller' || role === 'secondary_seller';
}

/**
 * Check if role is primary
 */
export function isPartyPrimaryRole(role: TransactionPartyRole): boolean {
  return role === 'primary_buyer' || role === 'primary_seller';
}

/**
 * Calculate party AML progress (0-100)
 * AML = Proof of Identity + Proof of Address
 */
export function getPartyAMLProgress(party: TransactionParty): number {
  let progress = 0;
  if (party.proofOfIdentityUploaded) progress += 50;
  if (party.proofOfAddressUploaded) progress += 50;
  return progress;
}

/**
 * Check if party has completed AML requirements
 */
export function isPartyAMLComplete(party: TransactionParty): boolean {
  return party.proofOfIdentityUploaded && party.proofOfAddressUploaded;
}

/**
 * Calculate buyer document progress (0-100)
 * Buyer docs = AML (ID + Address) + Proof of Funds + Mortgage (optional)
 */
export function getBuyerDocumentProgress(party: TransactionParty, hasMortgage = true): number {
  const totalDocs = hasMortgage ? 4 : 3;
  let completed = 0;
  if (party.proofOfIdentityUploaded) completed++;
  if (party.proofOfAddressUploaded) completed++;
  if (party.proofOfFundsUploaded) completed++;
  if (hasMortgage && party.mortgageAgreementUploaded) completed++;
  return Math.round((completed / totalDocs) * 100);
}

/**
 * Calculate seller document progress (0-100)
 * Seller docs = AML (ID + Address) + Title Deeds + EPC + TA6 + TA10
 */
export function getSellerDocumentProgress(party: TransactionParty): number {
  const totalDocs = 6;
  let completed = 0;
  if (party.proofOfIdentityUploaded) completed++;
  if (party.proofOfAddressUploaded) completed++;
  if (party.titleDeedsUploaded) completed++;
  if (party.epcUploaded) completed++;
  if (party.ta6FormUploaded) completed++;
  if (party.ta10FormUploaded) completed++;
  return Math.round((completed / totalDocs) * 100);
}

/**
 * Get display name for party role
 */
export function getPartyRoleDisplayName(role: TransactionPartyRole): string {
  switch (role) {
    case 'primary_buyer':
      return 'Primary Buyer';
    case 'secondary_buyer':
      return 'Secondary Buyer';
    case 'primary_seller':
      return 'Primary Seller';
    case 'secondary_seller':
      return 'Secondary Seller';
    default:
      return 'Unknown';
  }
}

/**
 * Get AML status display info
 */
export function getAMLStatusDisplay(status: AMLStatus): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'not_started':
      return { label: 'Not Started', color: '#6B7280', bgColor: '#6B728020' };
    case 'pending':
      return { label: 'Pending', color: '#F59E0B', bgColor: '#F59E0B20' };
    case 'verified':
      return { label: 'Verified', color: '#10B981', bgColor: '#10B98120' };
    case 'rejected':
      return { label: 'Rejected', color: '#EF4444', bgColor: '#EF444420' };
    default:
      return { label: 'Unknown', color: '#6B7280', bgColor: '#6B728020' };
  }
}

/**
 * Create a default party object
 */
export function createDefaultParty(
  role: TransactionPartyRole,
  name = '',
  email = ''
): Omit<TransactionParty, 'principal'> {
  return {
    role,
    name,
    email,
    isPrimary: isPartyPrimaryRole(role),
    joinedAt: Date.now(),
    amlStatus: 'not_started',
    // AML documents
    proofOfIdentityUploaded: false,
    proofOfAddressUploaded: false,
    amlComplete: false,
    // Buyer documents
    proofOfFundsUploaded: false,
    mortgageAgreementUploaded: false,
    // Seller documents
    titleDeedsUploaded: false,
    epcUploaded: false,
    ta6FormUploaded: false,
    ta10FormUploaded: false,
  };
}

/**
 * Normalize party data from canister response
 * Handles BigInt conversions and optional fields
 */
export function normalizeParty(rawParty: unknown): TransactionParty {
  const party = rawParty as Record<string, unknown>;

  return {
    principal: String(party.principal ?? ''),
    role: normalizePartyRole(party.role),
    name: String(party.name ?? ''),
    email: String(party.email ?? ''),
    isPrimary: Boolean(party.isPrimary),
    joinedAt: normalizeTimestamp(party.joinedAt),
    amlStatus: normalizeAMLStatus(party.amlStatus),
    // AML documents
    proofOfIdentityUploaded: Boolean(party.proofOfIdentityUploaded),
    proofOfAddressUploaded: Boolean(party.proofOfAddressUploaded),
    amlComplete: Boolean(party.amlComplete),
    // Buyer documents
    proofOfFundsUploaded: Boolean(party.proofOfFundsUploaded),
    mortgageAgreementUploaded: Boolean(party.mortgageAgreementUploaded),
    // Seller documents
    titleDeedsUploaded: Boolean(party.titleDeedsUploaded),
    epcUploaded: Boolean(party.epcUploaded),
    ta6FormUploaded: Boolean(party.ta6FormUploaded),
    ta10FormUploaded: Boolean(party.ta10FormUploaded),
  };
}

/**
 * Normalize party role from canister response
 */
function normalizePartyRole(role: unknown): TransactionPartyRole {
  if (typeof role === 'object' && role !== null) {
    // Handle variant format from Candid: { primary_buyer: null }
    const keys = Object.keys(role);
    if (keys.length === 1) {
      const key = keys[0];
      if (['primary_buyer', 'secondary_buyer', 'primary_seller', 'secondary_seller'].includes(key)) {
        return key as TransactionPartyRole;
      }
    }
  }
  if (typeof role === 'string') {
    return role as TransactionPartyRole;
  }
  return 'secondary_buyer'; // Default fallback
}

/**
 * Normalize AML status from canister response
 */
function normalizeAMLStatus(status: unknown): AMLStatus {
  if (typeof status === 'object' && status !== null) {
    // Handle variant format from Candid: { pending: null }
    const keys = Object.keys(status);
    if (keys.length === 1) {
      const key = keys[0];
      if (['not_started', 'pending', 'verified', 'rejected'].includes(key)) {
        return key as AMLStatus;
      }
    }
  }
  if (typeof status === 'string') {
    return status as AMLStatus;
  }
  return 'not_started'; // Default fallback
}

/**
 * Normalize timestamp from canister response
 */
function normalizeTimestamp(timestamp: unknown): number {
  if (typeof timestamp === 'bigint') {
    return Number(timestamp / BigInt(1_000_000)); // Convert nanoseconds to milliseconds
  }
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return parseInt(timestamp, 10) || Date.now();
  }
  return Date.now();
}
