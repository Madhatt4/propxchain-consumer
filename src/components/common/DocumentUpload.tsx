// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useCallback, useRef } from 'react';
import { Document, DocumentStatus } from '../../types/transaction.types';
import { icpService } from '../../services/icp.service';
import { getBackendDocumentName, getDocumentSubtypes, getOscarTypeFromSubtype } from '../../constants/documentTypes';
import { generateFileHash } from '../../utils/hashGenerator';
import { localDocumentRegistry } from '../../services/localDocumentRegistry';
import { logger } from '@/utils/logger';
import { cleanupDocumentState } from '@/utils/documentCleanup';
import { oscarDocumentAnalysis } from '../../services/oscar/oscarDocumentAnalysis.service';
import type {
  OscarAnalysisResult,
  TransactionContext
} from '../../types/oscar.types';
import OscarVerificationBadge, {
  type OscarVerificationStatus
} from './OscarVerificationBadge';
import OscarAnalysisPanel from './OscarAnalysisPanel';

interface DocumentUploadProps {
  transactionId?: string;
  propertyId?: number;
  documentType: string;
  documentName: string;
  category?: 'seller' | 'buyer' | 'shared';
  required: boolean;
  csrfToken?: string | null;
  onUpload: (document: Document, file?: File, oscarResult?: OscarAnalysisResult) => void;
  /** Callback when document is deleted */
  onDelete?: (document: Document) => void;
  existingDocument?: Document;
  disabled?: boolean;
  /** Enable Oscar AI document analysis */
  enableOscarAnalysis?: boolean;
  /** Transaction context for Oscar validation */
  transactionContext?: TransactionContext;
  /** Whether user is a solicitor (can override Oscar) */
  isSolicitor?: boolean;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  stage?: 'validating' | 'analyzing' | 'registering' | 'uploading' | 'complete';
}

interface OscarState {
  isAnalyzing: boolean;
  result: OscarAnalysisResult | null;
  pendingFile: File | null;
  showPanel: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  transactionId,
  propertyId,
  documentType,
  documentName,
  category,
  required,
  // csrfToken prop is deprecated - we now generate CSRF token from document_storage canister directly
  csrfToken: _csrfToken,
  onUpload,
  onDelete,
  existingDocument,
  disabled = false,
  enableOscarAnalysis = true,
  transactionContext,
  isSolicitor = false
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    stage: undefined
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Oscar analysis state
  const [oscarState, setOscarState] = useState<OscarState>({
    isAnalyzing: false,
    result: null,
    pendingFile: null,
    showPanel: false
  });

  // Load saved Oscar result from localStorage for existing documents
  // PRIMARY KEY: transactionId + documentType (these are props - always reliable!)
  React.useEffect(() => {
    if (existingDocument?.id && !oscarState.result) {
      // PRIMARY KEY: Use transaction ID + document type (most reliable - from props)
      const primaryKey = transactionId && documentType
        ? `oscar_tx_${transactionId}_${documentType}`
        : null;

      // Fallback keys for backwards compatibility
      const storageId = existingDocument.storageDocumentId;
      const docHash = existingDocument.hash;

      const keysToTry = [
        primaryKey, // Most reliable - based on props
        docHash ? `oscar_result_hash_${docHash}` : null,
        `oscar_result_${existingDocument.id}`,
        storageId ? `oscar_result_doc_${storageId}` : null
      ].filter((key, index, arr) => key && arr.indexOf(key) === index) as string[];

      logger.info('[Oscar] Looking for saved result with keys:', keysToTry);

      for (const savedKey of keysToTry) {
        const saved = localStorage.getItem(savedKey);
        if (saved) {
          try {
            const parsedResult = JSON.parse(saved) as OscarAnalysisResult;
            setOscarState(prev => ({
              ...prev,
              result: parsedResult,
              showPanel: true
            }));
            logger.info('[Oscar] Loaded saved result using key:', savedKey);

            // Migrate to primary key if found with a different key
            if (primaryKey && savedKey !== primaryKey) {
              try {
                localStorage.setItem(primaryKey, saved);
                logger.info('[Oscar] Migrated to primary key:', primaryKey);
              } catch (e) {
                // Ignore migration errors
              }
            }
            return; // Found it, exit
          } catch (e) {
            logger.warn('[Oscar] Failed to parse saved result from key:', savedKey);
          }
        }
      }

      logger.info('[Oscar] No saved result found for document:', existingDocument.id);
    }
  }, [existingDocument?.id, transactionId, documentType]);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Document subtype selection state
  const availableSubtypes = getDocumentSubtypes(documentName);
  const [selectedSubtype, setSelectedSubtype] = useState<string>(
    availableSubtypes.length > 0 ? availableSubtypes[0].id : ''
  );

  // Expanded view state for uploaded documents
  const [showExpandedView, setShowExpandedView] = useState(false);

  // Handle document deletion
  const handleDelete = async (): Promise<void> => {
    if (!existingDocument || !onDelete) return;

    setIsDeleting(true);
    try {
      // Clean up all localStorage keys (Oscar results, ID mappings) and IndexedDB registry
      cleanupDocumentState(existingDocument);

      await onDelete(existingDocument);
      setShowDeleteConfirm(false);
      // Reset Oscar state after deletion
      setOscarState({
        isAnalyzing: false,
        result: null,
        pendingFile: null,
        showPanel: false
      });
      setUploadState({
        isUploading: false,
        progress: 0,
        error: null,
        stage: undefined
      });
    } catch (error) {
      logger.error('[Upload] Delete error:', error);
      setUploadState((prev) => ({
        ...prev,
        error: 'Failed to delete document. Please try again.'
      }));
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if this document type supports Oscar analysis
  const supportsOscar =
    enableOscarAnalysis &&
    oscarDocumentAnalysis.supportsOscarAnalysis(documentType);

  // Map Oscar result to badge status
  const getOscarBadgeStatus = (
    result: OscarAnalysisResult
  ): OscarVerificationStatus => {
    if (result.verified && result.confidence >= 85) return 'verified';
    if (result.confidence >= 70) return 'review_needed';
    if (result.issues.some((i) => i.severity === 'error')) return 'rejected';
    return 'review_needed';
  };

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a PDF, JPG, or PNG file';
    }

    if (file.size > maxFileSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  /**
   * Run Oscar AI analysis on the file
   */
  const runOscarAnalysis = async (file: File): Promise<OscarAnalysisResult | null> => {
    if (!supportsOscar) return null;

    try {
      // Get Oscar type from selected subtype, or fall back to document type
      const oscarType = getOscarTypeFromSubtype(documentName, selectedSubtype) || documentType;
      logger.info('[Oscar] Starting document analysis for:', oscarType, '(subtype:', selectedSubtype, ')');

      setOscarState((prev) => ({
        ...prev,
        isAnalyzing: true,
        pendingFile: file
      }));

      const result = await oscarDocumentAnalysis.analyzeDocument(
        file,
        oscarType,
        transactionContext
      );

      logger.info('[Oscar] Analysis complete:', {
        verified: result.verified,
        confidence: result.confidence,
        issues: result.issues.length
      });

      setOscarState((prev) => ({
        ...prev,
        isAnalyzing: false,
        result,
        showPanel: true
      }));

      return result;
    } catch (error) {
      // Extract error details properly (Error objects have non-enumerable properties)
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown'
      };
      logger.error('[Oscar] Analysis error:', errorDetails);
      setOscarState((prev) => ({
        ...prev,
        isAnalyzing: false,
        result: null
      }));
      // Set error message for UI
      setUploadState((prev) => ({
        ...prev,
        error: `Oscar analysis failed: ${errorDetails.message}`
      }));
      // Don't block upload if Oscar fails
      return null;
    }
  };

  /**
   * Continue with registration after Oscar analysis (or skip)
   */
  const proceedWithRegistration = async (
    file: File,
    oscarResult?: OscarAnalysisResult | null
  ): Promise<void> => {
    setUploadState({
      isUploading: true,
      progress: 20,
      error: null,
      stage: 'registering'
    });

    try {
      // Initialize ICP service
      await icpService.initialize();

      setUploadState((prev) => ({ ...prev, progress: 30 }));

      // Step 1: Generate SHA-256 hash of the file (stays local)
      logger.info('[Upload] Generating document hash...');
      const documentHash = await generateFileHash(file);
      logger.info('[Upload] Hash generated:', documentHash.substring(0, 16) + '...');

      setUploadState((prev) => ({ ...prev, progress: 40 }));

      // Step 2: Get user principal
      const userPrincipal = await icpService.getUserPrincipal();

      // Step 3: Set storage location to onchain (full document stored on blockchain)
      const localPath = `${userPrincipal}/${propertyId}/${documentType}/${file.name}`;
      const storageLocation = 'onchain'; // Store full document on ICP blockchain

      setUploadState((prev) => ({ ...prev, progress: 40 }));

      // Step 4: Register hash on blockchain (hash-only storage for GDPR compliance)
      // Note: Full file content is stored locally by solicitor, only hash goes on-chain
      logger.info('[Upload] Registering document proof on blockchain...');
      await icpService.ensureDocumentStorageActor();

      // Generate CSRF token from document_storage canister (not user_management!)
      // Each canister has its own CSRF token store
      logger.info('[Upload] Generating document storage CSRF token...');
      const docStorageCsrfToken = await icpService.getDocumentStorageCsrfToken();

      // Call registerDocumentProof with 8 parameters matching canister interface
      const storageResult =
        await icpService.documentStorageActor!.registerDocumentProof(
          file.name,                                    // fileName: text
          documentHash,                                 // fileHash: text
          BigInt(file.size),                           // fileSize: nat
          file.type || 'application/octet-stream',     // contentType: text
          storageLocation,                             // storageLocation: text
          transactionId ? [transactionId] : [],        // transactionId: opt text
          documentType,                                // docType: text
          docStorageCsrfToken                          // csrfToken: text (from document_storage canister)
        );

      if ('err' in storageResult) {
        throw new Error(
          `Failed to register document proof: ${storageResult.err}`
        );
      }

      const storageDocId = storageResult.ok;
      logger.info('[Upload] Document proof registered, ID:', storageDocId);

      setUploadState((prev) => ({ ...prev, progress: 70 }));

      // Step 6: Register in document verification canister
      const numericTransactionId = transactionId?.replace(/^tx_/, '');
      const verificationDocId =
        await (await icpService.requireDocumentVerification()).registerDocument(
          BigInt(propertyId || 0),
          numericTransactionId ? [BigInt(numericTransactionId)] : [],
          documentType,
          documentHash,
          [BigInt(storageDocId)],
          [file.name],
          [BigInt(file.size)],
          [file.type || 'application/octet-stream']
        );

      // The canister returns 0 on access denial (#75): anonymous caller, or no
      // owner/transaction-member/solicitor relationship to the property. Don't
      // pretend success — surface it so the user sees why nothing was recorded.
      if (Number(verificationDocId) === 0) {
        throw new Error(
          "Access denied: you don't have permission to register this document against this property or transaction."
        );
      }

      logger.info('[Upload] Verification registered, ID:', verificationDocId);

      icpService.emitDocumentUploadedEvent(transactionId, file.name, documentType, documentHash);

      setUploadState((prev) => ({ ...prev, progress: 85 }));

      // Step 7: Register Oscar result on-chain (if available)
      if (oscarResult) {
        try {
          const chainResult =
            await oscarDocumentAnalysis.registerVerificationOnChain(
              Number(verificationDocId),
              oscarResult,
              documentType
            );
          if (chainResult.success) {
            logger.info(
              '[Oscar] Verification registered on-chain:',
              chainResult.verificationId
            );
          }
        } catch (oscarChainErr) {
          logger.warn('[Oscar] Failed to register on-chain:', oscarChainErr);
        }
      }

      // Step 8: Register in local document registry (for UI tracking)
      const localRecord = await localDocumentRegistry.registerDocument({
        blockchainId: Number(storageDocId),
        fileName: file.name,
        fileHash: documentHash,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        localPath: localPath,
        uploadedBy: userPrincipal,
        uploadedAt: new Date().toISOString(),
        propertyId: propertyId || 0,
        transactionId: transactionId,
        documentType: documentType,
        verified: oscarResult?.verified || false,
        notes: 'Full document stored on ICP blockchain (on-chain)'
      });

      logger.info('[Upload] Local registry updated:', localRecord.id);

      // Create document object for UI
      // IMPORTANT: Use storageDocId for id to match what getDocumentsByTransaction returns
      const document: Document = {
        id: `doc_${storageDocId}`,
        transactionId: transactionId || '',
        type: documentType,
        category: category || 'shared',
        name: documentName,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: userPrincipal,
        uploadedAt: new Date().toISOString(),
        status: oscarResult?.verified
          ? ('verified' as DocumentStatus)
          : ('uploaded' as DocumentStatus),
        required,
        hash: documentHash,
        storageDocumentId: Number(storageDocId),
        verificationDocumentId: Number(verificationDocId)
      };

      // Update progress tracking
      if (numericTransactionId) {
        try {
          const backendDocName = getBackendDocumentName(documentName);
          if (backendDocName) {
            // Via the service wrapper, which stringifies the id (the canister
            // keys by Text) and attaches the CSRF token the method requires.
            const progressUpdated =
              await icpService.updateMemberDocuments(numericTransactionId, backendDocName);
            if (progressUpdated) {
              logger.info('[Upload] Transaction progress updated');
            }
          }
        } catch (progressError) {
          logger.error('[Upload] Progress update error:', progressError);
        }
      }

      setUploadState({
        isUploading: false,
        progress: 100,
        error: null,
        stage: 'complete'
      });

      // Save ID mapping for future lookups (storageDocId -> verificationDocId)
      // This helps the load function find the Oscar result even if IDs don't match
      try {
        localStorage.setItem(`doc_id_mapping_${storageDocId}`, String(verificationDocId));
        logger.info('[Oscar] Saved ID mapping:', storageDocId, '->', verificationDocId);
      } catch (e) {
        // Ignore mapping save errors
      }

      // Keep Oscar result visible if analysis was performed
      if (oscarResult) {
        // Ensure analysisTimestamp is set (backend may not always provide it)
        const resultWithTimestamp: OscarAnalysisResult = {
          ...oscarResult,
          analysisTimestamp: oscarResult.analysisTimestamp || new Date().toISOString()
        };

        // PRIMARY KEY: transactionId + documentType (most reliable - from props!)
        const primaryKey = transactionId && documentType
          ? `oscar_tx_${transactionId}_${documentType}`
          : null;

        // Save Oscar result with primary key + fallbacks
        const keysToSave = [
          primaryKey, // PRIMARY: transaction + docType (always works!)
          `oscar_result_hash_${documentHash}`,
          `oscar_result_${document.id}`
        ].filter(Boolean) as string[];

        const oscarData = JSON.stringify(resultWithTimestamp);
        for (const savedKey of keysToSave) {
          try {
            localStorage.setItem(savedKey, oscarData);
          } catch (e) {
            logger.warn('[Oscar] Failed to save to localStorage key:', savedKey);
          }
        }
        logger.info('[Oscar] Saved result to localStorage keys:', keysToSave);

        setOscarState((prev) => ({
          ...prev,
          isAnalyzing: false,
          pendingFile: null,
          showPanel: true  // Keep panel visible to show verification status
        }));
      } else {
        setOscarState({
          isAnalyzing: false,
          result: null,
          pendingFile: null,
          showPanel: false
        });
      }

      onUpload(document, file, oscarResult || undefined);
    } catch (error) {
      logger.error('[Upload] Registration error:', error);

      let errorMessage = 'Registration failed. Please try again.';

      if (error instanceof Error) {
        const fullErrorText = error.message;

        if (
          fullErrorText.includes('IDL error') ||
          fullErrorText.includes('invalid type argument')
        ) {
          errorMessage =
            'Document verification failed. The canister interface may need updating.';
        } else if (fullErrorText.includes('ic0.trap')) {
          const trapMatch = fullErrorText.match(/message: '([^']+)'/);
          if (trapMatch && trapMatch[1]) {
            errorMessage = `Registration error: ${trapMatch[1]}`;
          } else {
            errorMessage = 'Registration failed due to a canister error.';
          }
        } else if (fullErrorText.includes('Invalid hash format')) {
          errorMessage = 'Invalid document hash format. Please try again.';
        } else if (fullErrorText.length < 200) {
          errorMessage = fullErrorText;
        }
      }

      setUploadState({
        isUploading: false,
        progress: 0,
        error: errorMessage,
        stage: undefined
      });
    }
  };

  const processFile = async (file: File): Promise<void> => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: validationError,
        stage: undefined
      });
      return;
    }

    // If Oscar analysis is enabled for this doc type, run analysis first
    if (supportsOscar) {
      setUploadState({
        isUploading: true,
        progress: 5,
        error: null,
        stage: 'analyzing'
      });

      const oscarResult = await runOscarAnalysis(file);

      // If Oscar found critical errors, pause for user review (but not for solicitor review requirement)
      if (
        oscarResult &&
        oscarResult.issues.some((i) => i.severity === 'error')
      ) {
        // Stop here - user needs to review and click proceed
        setUploadState({
          isUploading: false,
          progress: 15,
          error: null,
          stage: 'analyzing'
        });
        return;
      }

      // Auto-proceed if Oscar verification passed
      if (oscarResult && oscarResult.verified && oscarResult.confidence >= 85) {
        await proceedWithRegistration(file, oscarResult);
        return;
      }

      // Default: show panel and let user decide
      setUploadState({
        isUploading: false,
        progress: 15,
        error: null,
        stage: 'analyzing'
      });
      return;
    }

    // No Oscar analysis - proceed directly
    await proceedWithRegistration(file, null);
  };

  /**
   * Handle user clicking "Proceed" after Oscar review
   */
  const handleProceedAfterOscar = async (): Promise<void> => {
    if (!oscarState.pendingFile) return;
    await proceedWithRegistration(oscarState.pendingFile, oscarState.result);
  };

  /**
   * Handle solicitor override decision
   */
  const handleSolicitorOverride = async (
    approved: boolean,
    notes: string
  ): Promise<void> => {
    logger.info('[Oscar] Solicitor override:', { approved, notes });

    if (approved && oscarState.pendingFile) {
      // Create modified result with override
      const overriddenResult: OscarAnalysisResult | null = oscarState.result
        ? {
            ...oscarState.result,
            verified: true,
            requiresSolicitorReview: false,
            recommendations: [
              ...oscarState.result.recommendations,
              `Solicitor override: ${notes}`
            ]
          }
        : null;

      await proceedWithRegistration(oscarState.pendingFile, overriddenResult);
    } else {
      // Rejected - reset state
      setOscarState({
        isAnalyzing: false,
        result: null,
        pendingFile: null,
        showPanel: false
      });
      setUploadState({
        isUploading: false,
        progress: 0,
        error: 'Document rejected by solicitor review.',
        stage: undefined
      });
    }
  };

  /**
   * Cancel Oscar review and reset
   */
  const handleCancelOscar = (): void => {
    setOscarState({
      isAnalyzing: false,
      result: null,
      pendingFile: null,
      showPanel: false
    });
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      stage: undefined
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset the input value to allow re-uploading the same file
    event.target.value = '';
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = (event?: React.MouseEvent<HTMLDivElement>) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!disabled && !uploadState.isUploading) {
      fileInputRef.current?.click();
    }
  };

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case 'required': return 'border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20';
      case 'uploaded': return 'border-yellow-300 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-900/20';
      case 'verified': return 'border-green-300 dark:border-green-700/50 bg-green-50 dark:bg-green-900/20';
      case 'rejected': return 'border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20';
      default: return 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800';
    }
  };

  /**
   * Get key extracted data fields for summary display
   */
  const getSummaryFields = (extractedData: Record<string, unknown>): { label: string; value: string }[] => {
    const fields: { label: string; value: string }[] = [];
    const priorityKeys = ['fullName', 'name', 'dateOfBirth', 'passportNumber', 'licenceNumber', 'documentNumber', 'expiryDate', 'nationality', 'address'];

    for (const key of priorityKeys) {
      if (extractedData[key]) {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        fields.push({ label, value: String(extractedData[key]) });
      }
      if (fields.length >= 4) break; // Limit to 4 fields for compact view
    }
    return fields;
  };

  /**
   * Get document type label for display
   */
  const getDocumentTypeLabel = (): string => {
    if (selectedSubtype && availableSubtypes.length > 0) {
      const subtype = availableSubtypes.find(s => s.id === selectedSubtype);
      return subtype?.label || documentName;
    }
    return documentName;
  };

  /**
   * Truncate hash for display
   */
  const truncateHash = (hash: string): string => {
    if (!hash || hash.length <= 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const getStatusText = (status: DocumentStatus, hasOscarResult?: boolean) => {
    switch (status) {
      case 'required': return 'Required';
      case 'uploaded': return hasOscarResult ? 'Uploaded - AI Analyzed' : 'Uploaded - Pending Verification';
      case 'verified': return hasOscarResult ? '✓ AI Verified' : 'Verified';
      case 'rejected': return 'Rejected - Please Re-upload';
      default: return 'Not Uploaded';
    }
  };

  // Check if we should show compact summary (document uploaded with Oscar verification)
  const showCompactSummary = existingDocument && oscarState.result && (uploadState.stage === 'complete' || !uploadState.isUploading);

  // Compact Summary Card for uploaded documents
  if (showCompactSummary && !showExpandedView) {
    if (!oscarState.result) return null;
    const result = oscarState.result;
    const summaryFields = getSummaryFields(result.extractedData);
    const confidenceColor = result.confidence >= 85 ? 'text-green-600 dark:text-green-400' : result.confidence >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

    return (
      <div className="w-full">
        <div className={`border rounded-lg p-4 ${result.verified ? 'border-green-200 dark:border-green-700/50 bg-green-50 dark:bg-green-900/20' : 'border-yellow-200 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-900/20'}`}>
          {/* Header with document type and verification badge */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.verified ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                <svg className={`w-5 h-5 ${result.verified ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{getDocumentTypeLabel()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{existingDocument.fileName}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold ${confidenceColor}`}>{result.confidence}%</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">confidence</p>
            </div>
          </div>

          {/* Extracted Data Summary */}
          {summaryFields.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-sm">
              {summaryFields.map((field, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{field.label}:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate ml-2">{field.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hash and Upload Info */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-slate-700 pt-2 mt-2">
            <div className="flex items-center gap-4">
              <span title={existingDocument.hash}>Hash: {truncateHash(existingDocument.hash || '')}</span>
              <span>Uploaded: {new Date(existingDocument.uploadedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              {result.verified ? (
                <span className="text-green-600 dark:text-green-400 font-medium">✓ AI Verified</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">Pending Review</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowExpandedView(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              View Full Details
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Replace
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file input for replace functionality */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={disabled}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && existingDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Delete Document?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete "{existingDocument.fileName}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded view toggle (when user clicks "View Full Details")
  if (showCompactSummary && showExpandedView) {
    if (!oscarState.result) return null;
    const result = oscarState.result;
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {documentName}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <button
            type="button"
            onClick={() => setShowExpandedView(false)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            ← Back to Summary
          </button>
        </div>

        {/* Full Oscar Analysis Panel */}
        <OscarAnalysisPanel
          result={result}
          compact={false}
        />

        {/* Document Info */}
        <div className="text-xs text-gray-500 dark:text-gray-400 border-t dark:border-slate-700 pt-2">
          <p>File: {existingDocument.fileName} ({(existingDocument.fileSize / 1024 / 1024).toFixed(2)} MB)</p>
          <p>Hash: {existingDocument.hash}</p>
          <p>Uploaded: {new Date(existingDocument.uploadedAt).toLocaleString()}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-slate-600 px-3 py-1 rounded"
          >
            Replace Document
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-700/50 px-3 py-1 rounded"
            >
              Delete
            </button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={disabled}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && existingDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Delete Document?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete "{existingDocument.fileName}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {documentName}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {existingDocument && (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            existingDocument.status === 'verified' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
            existingDocument.status === 'uploaded' && oscarState.result ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
            existingDocument.status === 'uploaded' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
            existingDocument.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
            'bg-gray-100 dark:bg-slate-800/50 text-gray-800 dark:text-gray-200'
          }`}>
            {getStatusText(existingDocument.status, !!oscarState.result)}
          </span>
        )}
      </div>

      {/* Document subtype dropdown */}
      {availableSubtypes.length > 1 && !existingDocument && (
        <div className="mt-2">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Document Type
          </label>
          <select
            value={selectedSubtype}
            onChange={(e) => setSelectedSubtype(e.target.value)}
            disabled={disabled || uploadState.isUploading}
            className="w-full px-3 py-2 text-sm dark:bg-slate-800 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed"
          >
            {availableSubtypes.map((subtype) => (
              <option key={subtype.id} value={subtype.id}>
                {subtype.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-3 sm:p-6 text-center cursor-pointer
          transition-colors duration-200 touch-manipulation
          ${isDragOver ? 'border-gray-400 dark:border-slate-500 bg-gray-50 dark:bg-slate-800/50' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${existingDocument ? getStatusColor(existingDocument.status) : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        />

        {oscarState.isAnalyzing ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Oscar AI analyzing document...</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Verifying document authenticity and extracting data
            </p>
          </div>
        ) : uploadState.isUploading ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 dark:border-gray-200 mx-auto"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {uploadState.stage === 'uploading'
                ? 'Uploading document to blockchain...'
                : uploadState.stage === 'registering'
                  ? 'Registering on blockchain...'
                  : 'Processing...'}{' '}
              {uploadState.progress}%
            </p>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-gray-800 dark:bg-gray-200 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              ></div>
            </div>
          </div>
        ) : existingDocument ? (
          <div className="space-y-2">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{existingDocument.fileName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(existingDocument.fileSize / 1024 / 1024).toFixed(2)} MB •
                Uploaded {new Date(existingDocument.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <p className="text-xs text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200">
                Click to replace file
              </p>
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {isDragOver ? 'Drop file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>
          </div>
        )}

        {uploadState.error && (
          <div className="mt-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-md">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Upload Failed</p>
                <p className="text-sm text-red-700 dark:text-red-300 break-words">{uploadState.error}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setUploadState({
                      isUploading: false,
                      progress: 0,
                      error: null
                    });
                  }}
                  className="mt-3 min-h-[48px] px-4 py-2 text-sm text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 font-medium underline touch-manipulation"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Oscar Analysis Panel */}
      {oscarState.showPanel && oscarState.result && (
        <div className="space-y-3">
          {/* Badge summary */}
          <div className="flex items-center justify-between">
            <OscarVerificationBadge
              status={getOscarBadgeStatus(oscarState.result)}
              confidence={oscarState.result.confidence}
              issueCount={oscarState.result.issues.length}
              onClick={() =>
                setOscarState((prev) => ({
                  ...prev,
                  showPanel: !prev.showPanel
                }))
              }
            />
            {uploadState.stage === 'complete' ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✓ Document Registered
              </span>
            ) : oscarState.pendingFile ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {oscarState.pendingFile.name}
              </span>
            ) : null}
          </div>

          {/* Full analysis panel */}
          <OscarAnalysisPanel
            result={oscarState.result}
            onSolicitorOverride={
              isSolicitor && uploadState.stage !== 'complete' ? handleSolicitorOverride : undefined
            }
            canOverride={isSolicitor && uploadState.stage !== 'complete'}
            compact={false}
          />

          {/* Action buttons - only show before upload completes */}
          {uploadState.stage !== 'complete' && (
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancelOscar}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedAfterOscar}
                className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Proceed with Upload
              </button>
            </div>
          )}

          {/* Success message after upload */}
          {uploadState.stage === 'complete' && (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded text-sm text-green-700 dark:text-green-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Document verified by Oscar AI and registered on blockchain
              </span>
            </div>
          )}
        </div>
      )}

      {existingDocument && existingDocument.notes && (
        <div className="p-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-md">
          <p className="text-xs text-gray-800 dark:text-gray-200">
            <span className="font-medium">Note:</span> {existingDocument.notes}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && existingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Delete Document?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete "{existingDocument.fileName}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
