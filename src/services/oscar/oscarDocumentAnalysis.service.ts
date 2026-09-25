// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '@/lib/supabase';
import { icpService } from '../icp.service';
import { logger } from '../../utils/logger';
import { getStorePrincipalId } from '../../stores/authStore';
import type {
  OscarIssue,
  DataMismatch,
  OscarAnalysisResult,
  TransactionContext,
  OscarDocumentType
} from '../../types/oscar.types';

// Supported document types for Oscar analysis (internal format)
export const OSCAR_SUPPORTED_TYPES: readonly OscarDocumentType[] = [
  'passport',
  'driving_licence',
  'title_deed',
  'ta6_form',
  'ta7_form',
  'ta10_form',
  'epc_certificate',
  'mortgage_offer',
  'proof_of_funds',
  'bank_statement',
  'lr_official_copy'
] as const;

/**
 * Map app document type names to Oscar internal format
 * Primary format: storageKey from DOCUMENT_TYPES (camelCase)
 * Also supports: display names, legacy hyphenated names, party-prefixed names
 */
const DOCUMENT_TYPE_MAPPING: Record<string, OscarDocumentType> = {
  // Identity documents - canonical: proofOfIdentity
  'proofOfIdentity': 'passport',
  'Proof of Identity': 'passport',
  'proof-of-identity': 'passport',
  'passport': 'passport',
  'driving_licence': 'driving_licence',
  'Driving Licence': 'driving_licence',
  // Legacy party-specific names
  'buyer-id': 'passport',
  'seller-id': 'passport',

  // Address documents - canonical: proofOfAddress
  'proofOfAddress': 'bank_statement',
  'Proof of Address': 'bank_statement',
  'proof-of-address': 'bank_statement',
  'bank_statement': 'bank_statement',
  'Bank Statement': 'bank_statement',
  // Legacy party-specific names
  'buyer-proof-of-address': 'bank_statement',
  'seller-proof-of-address': 'bank_statement',

  // Funds documents - canonical: proofOfFunds
  'proofOfFunds': 'proof_of_funds',
  'Proof of Funds': 'proof_of_funds',
  'proof-of-funds': 'proof_of_funds',
  'proof_of_funds': 'proof_of_funds',

  // Title Deeds - canonical: titleDeeds
  'titleDeeds': 'title_deed',
  'Title Deeds': 'title_deed',
  'title-deeds': 'title_deed',
  'title_deed': 'title_deed',

  // EPC - canonical: energyPerformanceCertificate
  'energyPerformanceCertificate': 'epc_certificate',
  'Energy Performance Certificate': 'epc_certificate',
  'epc-certificate': 'epc_certificate',
  'epc_certificate': 'epc_certificate',
  'EPC': 'epc_certificate',

  // TA6 - canonical: ta6PropertyInformationForm
  'ta6PropertyInformationForm': 'ta6_form',
  'TA6 Property Information Form': 'ta6_form',
  'ta6-form': 'ta6_form',
  'ta6_form': 'ta6_form',
  'TA6': 'ta6_form',

  // TA7 - canonical: ta7LeaseholdInformationForm
  'ta7LeaseholdInformationForm': 'ta7_form',
  'TA7 Leasehold Information Form': 'ta7_form',
  'ta7-form': 'ta7_form',
  'ta7_form': 'ta7_form',
  'TA7': 'ta7_form',

  // TA10 - canonical: ta10FittingsContents
  'ta10FittingsContents': 'ta10_form',
  'TA10 Fittings & Contents Form': 'ta10_form',
  'ta10-form': 'ta10_form',
  'ta10_form': 'ta10_form',
  'TA10': 'ta10_form',

  // Mortgage - canonical: mortgageAgreement
  'mortgageAgreement': 'mortgage_offer',
  'Mortgage Agreement': 'mortgage_offer',
  'mortgage-agreement': 'mortgage_offer',
  'mortgage_offer': 'mortgage_offer',
  'Mortgage Offer': 'mortgage_offer',

  // LR Official Copy - canonical: lrOfficialCopy
  'lrOfficialCopy': 'lr_official_copy',
  'LR Official Copy': 'lr_official_copy',
  'lr-official-copy': 'lr_official_copy',
  'lr_official_copy': 'lr_official_copy',
  'officialCopyRegister': 'lr_official_copy',
  'Official Copy of Register': 'lr_official_copy'
};

/**
 * Convert app document type to Oscar internal format
 * Handles dynamic suffixes for secondary party documents (e.g., "buyer-id-12345678")
 */
export function mapToOscarType(appDocType: string): OscarDocumentType | null {
  // Direct lookup first
  if (DOCUMENT_TYPE_MAPPING[appDocType]) {
    return DOCUMENT_TYPE_MAPPING[appDocType];
  }

  // Handle multi-party person variants (e.g., "proofOfAddress_person1", "proofOfIdentity_person2")
  // Strip _person[N] suffix and try again
  const personStripped = appDocType.replace(/_person\d+$/, '');
  if (personStripped !== appDocType && DOCUMENT_TYPE_MAPPING[personStripped]) {
    return DOCUMENT_TYPE_MAPPING[personStripped];
  }

  // Handle party-specific document types with principal suffix (e.g., "buyer-id-12345678")
  // Strip the suffix (last part after the last hyphen if it looks like a principal fragment)
  const parts = appDocType.split('-');
  if (parts.length >= 3) {
    // Try removing the last part (principal suffix)
    const baseType = parts.slice(0, -1).join('-');
    if (DOCUMENT_TYPE_MAPPING[baseType]) {
      return DOCUMENT_TYPE_MAPPING[baseType];
    }
  }

  return null;
}

// Valid MIME types for document analysis
const VALID_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg'
] as const;

// Maximum file size for analysis (25MB)
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Request timeout for analysis (30 seconds)
const ANALYSIS_TIMEOUT_MS = 30000;

/**
 * Oscar Document Analysis Service
 * Provides AI-powered document verification through the Render backend
 */
class OscarDocumentAnalysisService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_OSCAR_BACKEND_URL ||
      'https://propxchain.onrender.com';
  }

  /**
   * Check if a document type is supported by Oscar analysis
   */
  supportsOscarAnalysis(documentType: string): boolean {
    // Check direct match or mapped type
    const mappedType = mapToOscarType(documentType);
    return mappedType !== null || OSCAR_SUPPORTED_TYPES.includes(documentType as OscarDocumentType);
  }

  /**
   * Get list of supported document types
   */
  getSupportedTypes(): readonly OscarDocumentType[] {
    return OSCAR_SUPPORTED_TYPES;
  }

  /**
   * Convert file to base64 string
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const result = reader.result as string;
        // Remove data URL prefix (data:image/png;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (): void => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate file before analysis
   */
  private validateFile(file: File): void {
    // Validate MIME type
    if (!VALID_MIME_TYPES.includes(file.type as typeof VALID_MIME_TYPES[number])) {
      throw new Error(
        `Unsupported file type: ${file.type}. Supported: PDF, JPG, PNG`
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      throw new Error(
        `File too large: ${sizeMB}MB. Maximum: 25MB`
      );
    }
  }

  /**
   * Analyze a document using Oscar AI
   * @param file - The file to analyze
   * @param documentType - App document type (will be mapped to Oscar format)
   * @param transactionContext - Optional transaction context for validation
   */
  async analyzeDocument(
    file: File,
    documentType: string,
    transactionContext?: TransactionContext
  ): Promise<OscarAnalysisResult> {
    // Map app document type to Oscar internal format
    const oscarType = mapToOscarType(documentType) || (documentType as OscarDocumentType);

    logger.info('Oscar document analysis starting', {
      originalType: documentType,
      oscarType,
      fileName: file.name,
      fileSize: file.size
    });

    // Validate file
    this.validateFile(file);

    // Get principal ID for auth
    const principalId = getStorePrincipalId();
    if (!principalId) {
      throw new Error('Not authenticated');
    }

    // The Oscar worker now requires a Supabase JWT (audit #61) so the Anthropic
    // proxy can't be abused by anonymous callers. Email/password users have a
    // session; Internet Identity-only users do not, so surface a clear message.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Document analysis requires an email sign-in. Please log in with your email and password.');
    }

    // Convert file to base64
    const fileBase64 = await this.fileToBase64(file);

    // Set up timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/api/documents/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          principalId,
          documentType: oscarType,  // Use mapped Oscar type
          fileBase64,
          mimeType: file.type,
          transactionContext
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Analysis failed'
        }));
        throw new Error(
          errorData.error || `Analysis failed: ${response.status}`
        );
      }

      const result: OscarAnalysisResult = await response.json();

      // Ensure analysisTimestamp is always set (backend may not provide it)
      const resultWithTimestamp: OscarAnalysisResult = {
        ...result,
        analysisTimestamp: result.analysisTimestamp || new Date().toISOString()
      };

      logger.info('Oscar document analysis completed', {
        verified: resultWithTimestamp.verified,
        confidence: resultWithTimestamp.confidence,
        issueCount: resultWithTimestamp.issues.length,
        timestamp: resultWithTimestamp.analysisTimestamp
      });

      return resultWithTimestamp;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Oscar analysis timed out');
        // Return timeout fallback response
        return this.createTimeoutResponse();
      }

      // Extract error details properly (Error objects have non-enumerable properties)
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      };
      logger.error('Oscar analysis failed:', errorDetails);

      // Re-throw with proper error
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  /**
   * Create a timeout response when analysis takes too long
   */
  private createTimeoutResponse(): OscarAnalysisResult {
    return {
      verified: false,
      confidence: 0,
      issues: [
        {
          severity: 'warning',
          code: 'OSCAR_TIMEOUT',
          message:
            'Oscar analysis timed out. Document will require manual solicitor verification.'
        }
      ],
      extractedData: {},
      mismatches: [],
      recommendations: ['Submit for manual solicitor verification'],
      requiresSolicitorReview: true,
      analysisTimestamp: new Date().toISOString()
    };
  }

  /**
   * Register Oscar verification result on-chain
   * Note: This requires the document_verification canister to have verifyWithOscar method
   */
  async registerVerificationOnChain(
    documentId: number,
    analysisResult: OscarAnalysisResult,
    documentType: string
  ): Promise<{ success: boolean; verificationId?: number; error?: string }> {
    try {
      await icpService.initialize();

      // Check if the canister has the verifyWithOscar method
      if (!icpService.documentVerificationActor) {
        return {
          success: false,
          error: 'Document verification actor not initialized'
        };
      }

      // Map severity to canister variant format. Returns the variant union
      // rather than Record<string, null>: a computed key produces a type wide
      // enough to satisfy nothing, and an exhaustive switch also fails the
      // build if a new severity is added to OscarIssue without being mapped.
      const mapSeverity = (
        severity: OscarIssue['severity']
      ): { error: null } | { warning: null } | { info: null } => {
        switch (severity) {
          case 'error':
            return { error: null };
          case 'warning':
            return { warning: null };
          case 'info':
            return { info: null };
        }
      };

      // Map to canister input format
      const oscarInput = {
        // Nat on the canister (0-100), so it must be an integral bigint —
        // passing the raw JS number failed to encode.
        confidence: BigInt(Math.round(analysisResult.confidence)),
        issues: analysisResult.issues.map((issue) => ({
          severity: mapSeverity(issue.severity),
          code: issue.code,
          message: issue.message,
          // Candid `opt text` is a 0- or 1-element tuple; the bare ternary
          // widens to string[], which the generated type rejects.
          field: (issue.field ? [issue.field] : []) as [] | [string]
        })),
        extractedData: JSON.stringify(analysisResult.extractedData),
        mismatches: analysisResult.mismatches.map((mismatch) => ({
          field: mismatch.field,
          expected: mismatch.expected,
          found: mismatch.found
        })),
        requiresSolicitorReview: analysisResult.requiresSolicitorReview,
        documentType
      };

      // Check if method exists before calling
      if (
        typeof icpService.documentVerificationActor.verifyWithOscar ===
        'function'
      ) {
        const result =
          await icpService.documentVerificationActor.verifyWithOscar(
            BigInt(documentId),
            oscarInput
          );

        if ('ok' in result) {
          logger.info('Oscar verification registered on-chain', {
            documentId,
            verificationId: Number(result.ok.id)
          });
          return { success: true, verificationId: Number(result.ok.id) };
        } else {
          return { success: false, error: result.err };
        }
      }

      // Fallback: Use existing verification methods
      logger.info(
        'verifyWithOscar not available, using standard verification'
      );
      const verifyResult =
        await icpService.documentVerificationActor.verifyDocumentWithHash(
          BigInt(documentId),
          analysisResult.verified ? [] : ['Oscar AI verification pending']
        );

      if ('ok' in verifyResult) {
        return { success: true, verificationId: Number(verifyResult.ok.id) };
      } else {
        return { success: false, error: verifyResult.err };
      }
    } catch (error) {
      logger.error('Failed to register Oscar verification on-chain:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to register verification'
      };
    }
  }

  /**
   * Get confidence level label and color
   */
  getConfidenceLabel(confidence: number): { label: string; color: string } {
    if (confidence >= 85) {
      return { label: 'High', color: 'green' };
    }
    if (confidence >= 70) {
      return { label: 'Medium', color: 'yellow' };
    }
    if (confidence >= 50) {
      return { label: 'Low', color: 'orange' };
    }
    return { label: 'Very Low', color: 'red' };
  }

  /**
   * Check if result should auto-verify based on confidence threshold
   */
  shouldAutoVerify(result: OscarAnalysisResult, threshold = 85): boolean {
    const hasErrors = result.issues.some((issue) => issue.severity === 'error');
    return (
      result.confidence >= threshold &&
      !hasErrors &&
      !result.requiresSolicitorReview
    );
  }

  /**
   * Get severity priority for sorting issues
   */
  getSeverityPriority(severity: OscarIssue['severity']): number {
    const priorities: Record<OscarIssue['severity'], number> = {
      error: 0,
      warning: 1,
      info: 2
    };
    return priorities[severity];
  }

  /**
   * Sort issues by severity (errors first, then warnings, then info)
   */
  sortIssuesBySeverity(issues: OscarIssue[]): OscarIssue[] {
    return [...issues].sort(
      (a, b) =>
        this.getSeverityPriority(a.severity) -
        this.getSeverityPriority(b.severity)
    );
  }

  /**
   * Get human-readable document type label
   */
  getDocumentTypeLabel(documentType: OscarDocumentType): string {
    const labels: Record<OscarDocumentType, string> = {
      passport: 'Passport',
      driving_licence: 'Driving Licence',
      title_deed: 'Title Deed',
      ta6_form: 'TA6 Property Information Form',
      ta7_form: 'TA7 Leasehold Information Form',
      ta10_form: 'TA10 Fittings and Contents Form',
      epc_certificate: 'EPC Certificate',
      mortgage_offer: 'Mortgage Offer',
      proof_of_funds: 'Proof of Funds',
      bank_statement: 'Bank Statement',
      lr_official_copy: 'LR Official Copy of Register'
    };
    return labels[documentType] || documentType;
  }
}

// Export singleton instance
export const oscarDocumentAnalysis = new OscarDocumentAnalysisService();
export default oscarDocumentAnalysis;

// Re-export types for convenience
export type {
  OscarIssue,
  DataMismatch,
  OscarAnalysisResult,
  TransactionContext,
  OscarDocumentType
};
