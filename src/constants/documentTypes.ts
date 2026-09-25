// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Canonical Document Type Definitions
 *
 * This file defines the standardized document types used across the PropXchain platform.
 * It ensures consistency between frontend UI, backend canisters, and progress tracking.
 *
 * IMPORTANT: These names must match exactly with the backend user_management canister
 * required documents definitions.
 */

export type UserRole = 'buyer' | 'seller' | 'solicitor' | 'admin';

/**
 * Document subtype definition
 */
export interface DocumentSubtype {
  id: string;
  label: string;
  oscarType?: string; // Maps to Oscar AI verification type
}

/**
 * Acceptable document subtypes for each main document category
 * These align with UK property conveyancing requirements and Oscar AI verification
 */
export const DOCUMENT_SUBTYPES: Record<string, DocumentSubtype[]> = {
  // Proof of Identity - Acceptable ID documents
  'Proof of Identity': [
    { id: 'passport', label: 'Passport', oscarType: 'passport' },
    { id: 'driving_licence', label: 'Driving Licence', oscarType: 'driving_licence' },
    { id: 'national_id', label: 'National ID Card' },
    { id: 'biometric_permit', label: 'Biometric Residence Permit' }
  ],

  // Proof of Address - Must be dated within last 3 months
  'Proof of Address': [
    { id: 'bank_statement', label: 'Bank Statement', oscarType: 'bank_statement' },
    { id: 'utility_bill', label: 'Utility Bill (Gas/Electric/Water)' },
    { id: 'council_tax', label: 'Council Tax Bill' },
    { id: 'mortgage_statement', label: 'Mortgage Statement' }
  ],

  // Proof of Funds - Evidence of purchase funds
  'Proof of Funds': [
    { id: 'bank_statement', label: 'Bank Statement', oscarType: 'bank_statement' },
    { id: 'savings_statement', label: 'Savings Account Statement' },
    { id: 'investment_statement', label: 'Investment Portfolio Statement' },
    { id: 'gift_letter', label: 'Gift Letter (with supporting bank statement)' },
    { id: 'mortgage_aip', label: 'Mortgage Agreement in Principle' }
  ],

  // Title Deeds - Property ownership documents
  'Title Deeds': [
    { id: 'official_copy', label: 'Official Copy of Register', oscarType: 'title_deed' },
    { id: 'title_plan', label: 'Title Plan' },
    { id: 'lease_document', label: 'Lease Document (Leasehold)' }
  ],

  // Mortgage Agreement
  'Mortgage Agreement': [
    { id: 'mortgage_offer', label: 'Mortgage Offer', oscarType: 'mortgage_offer' },
    { id: 'mortgage_aip', label: 'Agreement in Principle' }
  ],

  // Energy Performance Certificate
  'Energy Performance Certificate': [
    { id: 'epc_certificate', label: 'EPC Certificate', oscarType: 'epc_certificate' }
  ],

  // TA6 Property Information Form
  'TA6 Property Information Form': [
    { id: 'ta6_form', label: 'TA6 Form (Law Society)', oscarType: 'ta6_form' },
    { id: 'ta6_equivalent', label: 'Equivalent Property Information Form' }
  ],

  // TA10 Fittings & Contents
  'TA10 Fittings & Contents Form': [
    { id: 'ta10_form', label: 'TA10 Form (Law Society)', oscarType: 'ta10_form' },
    { id: 'ta10_equivalent', label: 'Equivalent Fittings Form' }
  ],

  // Solicitor documents
  'Solicitor License': [
    { id: 'practicing_cert', label: 'SRA Practicing Certificate' },
    { id: 'cilex_cert', label: 'CILEx Practising Certificate' }
  ],

  'Professional Indemnity Insurance': [
    { id: 'pii_certificate', label: 'PII Certificate' },
    { id: 'pii_schedule', label: 'Insurance Schedule' }
  ],

  'AML Certificate': [
    { id: 'aml_training', label: 'AML Training Certificate' },
    { id: 'aml_compliance', label: 'Firm AML Compliance Certificate' }
  ]
};

/**
 * Get subtypes for a document type
 */
export function getDocumentSubtypes(documentType: string): DocumentSubtype[] {
  return DOCUMENT_SUBTYPES[documentType] || [];
}

/**
 * Get Oscar verification type from subtype
 */
export function getOscarTypeFromSubtype(documentType: string, subtypeId: string): string | null {
  const subtypes = DOCUMENT_SUBTYPES[documentType];
  if (!subtypes) return null;
  const subtype = subtypes.find(s => s.id === subtypeId);
  return subtype?.oscarType || null;
}

/**
 * Document type mapping from UI display names to backend canister names
 */
export const DOCUMENT_TYPES = {
  // Buyer Documents
  // AML (Proof of Identity / Proof of Address) is NOT collected from individual
  // buyers/sellers by PropXchain at launch — the estate agent and/or conveyancer
  // run their own AML/KYC. A provider panel for AML is a future addition. Keep the
  // definitions so a future panel can re-enable them per role; just don't require
  // them of buyers/sellers. (Solicitor Proof of Identity left in place — solicitors
  // verify via CLC panel registration.)
  PROOF_OF_IDENTITY: {
    displayName: 'Proof of Identity',
    backendName: 'Proof of Identity',
    storageKey: 'proofOfIdentity',
    description: 'Valid passport, driver\'s license, or national ID card',
    required: ['solicitor'] as UserRole[]
  },
  PROOF_OF_ADDRESS: {
    displayName: 'Proof of Address',
    backendName: 'Proof of Address',
    storageKey: 'proofOfAddress',
    description: 'Recent utility bill, bank statement, or council tax bill (within 3 months)',
    required: [] as UserRole[]
  },
  PROOF_OF_FUNDS: {
    displayName: 'Proof of Funds',
    backendName: 'Proof of Funds',
    storageKey: 'proofOfFunds',
    description: 'Bank statement showing available funds for purchase',
    required: ['buyer'] as UserRole[]
  },
  MORTGAGE_AGREEMENT: {
    displayName: 'Mortgage Agreement',
    backendName: 'Mortgage Agreement',
    storageKey: 'mortgageAgreement',
    description: 'Mortgage approval letter or agreement in principle',
    required: ['buyer'] as UserRole[]
  },

  // Seller Documents
  TITLE_DEEDS: {
    displayName: 'Title Deeds',
    backendName: 'Title Deeds',
    storageKey: 'titleDeeds',
    description: 'Official property ownership documents from Land Registry',
    required: ['seller'] as UserRole[]
  },
  ENERGY_PERFORMANCE_CERTIFICATE: {
    displayName: 'Energy Performance Certificate',
    backendName: 'Energy Performance Certificate',
    storageKey: 'energyPerformanceCertificate',
    description: 'Valid EPC certificate (less than 10 years old)',
    required: ['seller'] as UserRole[]
  },
  TA6_PROPERTY_INFORMATION_FORM: {
    displayName: 'TA6 Property Information Form',
    backendName: 'TA6 Property Information Form',
    storageKey: 'ta6PropertyInformationForm',
    description: 'Law Society standard property questionnaire',
    required: ['seller'] as UserRole[]
  },
  TA10_FITTINGS_CONTENTS: {
    displayName: 'TA10 Fittings & Contents Form',
    backendName: 'TA10 Fittings & Contents Form',
    storageKey: 'ta10FittingsContents',
    description: 'Law Society standard form listing fixtures and fittings included in sale',
    required: ['seller'] as UserRole[]
  },

  // Solicitor Documents
  SOLICITOR_LICENSE: {
    displayName: 'Solicitor License',
    backendName: 'Solicitor License',
    storageKey: 'solicitorLicense',
    description: 'Valid practicing certificate from SRA',
    required: ['solicitor'] as UserRole[]
  },
  PROFESSIONAL_INDEMNITY_INSURANCE: {
    displayName: 'Professional Indemnity Insurance',
    backendName: 'Professional Indemnity Insurance',
    storageKey: 'professionalIndemnityInsurance',
    description: 'Current professional indemnity insurance certificate',
    required: ['solicitor'] as UserRole[]
  },
  AML_CERTIFICATE: {
    displayName: 'AML Certificate',
    backendName: 'AML Certificate',
    storageKey: 'amlCertificate',
    description: 'Anti-Money Laundering compliance certificate',
    required: ['solicitor'] as UserRole[]
  },

  // Optional/Additional Documents (not required by backend)
  SURVEY_REPORT: {
    displayName: 'Survey Report',
    backendName: 'Survey Report',
    storageKey: 'surveyReport',
    description: 'Property survey report (optional)',
    required: [] as UserRole[]
  },
  LAND_REGISTRY_CONFIRMATION: {
    displayName: 'Land Registry Confirmation',
    backendName: 'Land Registry Confirmation',
    storageKey: 'landRegistryConfirmation',
    description: 'HM Land Registry official copy (optional)',
    required: [] as UserRole[]
  }
} as const;

/**
 * Type guard to check if a document type key is valid
 */
export type DocumentTypeKey = keyof typeof DOCUMENT_TYPES;

/**
 * Get the backend canister name for a document type
 * This is used when calling updateMemberDocuments() in user_management canister
 */
export function getBackendDocumentName(displayName: string): string | null {
  const entry = Object.values(DOCUMENT_TYPES).find(
    doc => doc.displayName === displayName || doc.storageKey === displayName
  );
  return entry ? entry.backendName : null;
}

/**
 * Get the storage key for a document type (used for localStorage and frontend state)
 */
export function getStorageKey(displayName: string): string {
  const entry = Object.values(DOCUMENT_TYPES).find(
    doc => doc.displayName === displayName
  );
  return entry ? entry.storageKey : displayName.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get party counts (seller/buyer) for a transaction from localStorage
 * Returns { sellerCount: 1|2, buyerCount: 1|2 }
 */
export function getPartyCountsForTransaction(transactionId: string): { sellerCount: 1 | 2; buyerCount: 1 | 2 } {
  try {
    const txPartyCount = JSON.parse(localStorage.getItem('txPartyCount') || '{}');
    const counts = txPartyCount[transactionId];
    return {
      sellerCount: counts?.sellerCount || 1,
      buyerCount: counts?.buyerCount || 1
    };
  } catch {
    return { sellerCount: 1, buyerCount: 1 };
  }
}

/**
 * Get required documents for a user role
 * Returns array of document type definitions
 *
 * @param role - The user role (buyer, seller, solicitor, admin)
 * @param transaction - Optional transaction object to check for conditional requirements
 * @param partyCount - Optional number of people (1 or 2) to determine ID/address doc count
 * @returns Array of required document types
 */
export function getRequiredDocumentsForRole(
  role: 'buyer' | 'seller' | 'solicitor' | 'admin',
  transaction?: any,
  partyCount?: 1 | 2
) {
  if (role === 'admin') return [];

  // Get base required documents for role
  let requiredDocs = Object.values(DOCUMENT_TYPES).filter(doc =>
    doc.required.includes(role)
  );

  // Apply conditional logic for mortgage documents
  if (role === 'buyer' && transaction) {
    // Check if transaction has mortgage information
    const hasMortgage = transaction.wizardData?.financialTerms?.hasMortgage ||
                       transaction.financialTerms?.hasMortgage ||
                       // Fallback: if mortgageAmount is provided and > 0, assume mortgage
                       (transaction.wizardData?.financialTerms?.mortgageAmount &&
                        parseFloat(transaction.wizardData.financialTerms.mortgageAmount) > 0) ||
                       (transaction.financialTerms?.mortgageAmount &&
                        parseFloat(transaction.financialTerms.mortgageAmount) > 0);

    // If no mortgage (cash buyer), exclude mortgage agreement
    if (hasMortgage === false) {
      requiredDocs = requiredDocs.filter(doc =>
        doc.storageKey !== 'mortgageAgreement'
      );
    }
  }

  // If partyCount is 2, duplicate Proof of Identity and Proof of Address
  // to require docs for both people (e.g., joint buyers or joint sellers)
  if (partyCount === 2) {
    const expandedDocs: Array<{ displayName: string; backendName: string; storageKey: string; description: string; required: UserRole[] }> = [];
    for (const doc of requiredDocs) {
      if (doc.storageKey === 'proofOfIdentity' || doc.storageKey === 'proofOfAddress') {
        // Add Person 1 and Person 2 variants
        expandedDocs.push({
          ...doc,
          displayName: `${doc.displayName} - Person 1`,
          storageKey: `${doc.storageKey}_person1`
        });
        expandedDocs.push({
          ...doc,
          displayName: `${doc.displayName} - Person 2`,
          storageKey: `${doc.storageKey}_person2`
        });
      } else {
        expandedDocs.push(doc);
      }
    }
    return expandedDocs;
  }

  return requiredDocs;
}

/**
 * Legacy mapping for backwards compatibility
 * Maps old camelCase keys to new standardized names
 */
export const LEGACY_DOCUMENT_MAPPING: { [key: string]: string } = {
  'proofOfID': 'Proof of Identity',
  'proofOfAddress': 'Proof of Address',
  'proofOfFunds': 'Proof of Funds',
  'proofOfOwnership': 'Title Deeds',
  'propertyDeed': 'Title Deeds',
  'surveyReport': 'Survey Report',
  'landRegistry': 'Land Registry Confirmation',
  'mortgageApproval': 'Mortgage Agreement'
};

/**
 * Convert legacy document key to standardized backend name
 */
export function legacyKeyToBackendName(legacyKey: string): string {
  return LEGACY_DOCUMENT_MAPPING[legacyKey] || legacyKey;
}
