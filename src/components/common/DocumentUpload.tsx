// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useCallback, useRef } from 'react';
import { Document, DocumentStatus } from '../../types/transaction.types';
import { icpService } from '../../services/icp.service';
import { getBackendDocumentName, getDocumentSubtypes } from '../../constants/documentTypes';
import { generateFileHash } from '../../utils/hashGenerator';
import { onChainFileName } from '../../lib/onChainDocument';
import { localDocumentRegistry } from '../../services/localDocumentRegistry';
import { logger } from '@/utils/logger';
import { cleanupDocumentState } from '@/utils/documentCleanup';
import ScanButton from './ScanButton';
import GoogleDriveButton from './GoogleDriveButton';

interface DocumentUploadProps {
  transactionId?: string;
  propertyId?: number;
  documentType: string;
  documentName: string;
  category?: 'seller' | 'buyer' | 'shared';
  required: boolean;
  csrfToken?: string | null;
  onUpload: (document: Document, file?: File) => void;
  /** Callback when document is deleted */
  onDelete?: (document: Document) => void;
  existingDocument?: Document;
  disabled?: boolean;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  stage?: 'validating' | 'registering' | 'uploading' | 'complete';
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
  disabled = false
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    stage: undefined
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Document subtype selection state
  const availableSubtypes = getDocumentSubtypes(documentName);
  const [selectedSubtype, setSelectedSubtype] = useState<string>(
    availableSubtypes.length > 0 ? availableSubtypes[0].id : ''
  );

  // Handle document deletion
  const handleDelete = async (): Promise<void> => {
    if (!existingDocument || !onDelete) return;

    setIsDeleting(true);
    try {
      // Clean up all localStorage keys (old analysis results, ID mappings) and IndexedDB registry
      cleanupDocumentState(existingDocument);

      await onDelete(existingDocument);
      setShowDeleteConfirm(false);
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
   * Hash the file, register its proof on chain and record it on the transaction.
   */
  const proceedWithRegistration = async (file: File): Promise<void> => {
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
          onChainFileName(documentType, file.name),     // fileName: generic, never the user's own
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
          [onChainFileName(documentType, file.name)],
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

      setUploadState((prev) => ({ ...prev, progress: 85 }));

      // Step 7: Register in local document registry (for UI tracking)
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
        verified: false,
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
        status: 'uploaded' as DocumentStatus,
        required,
        hash: documentHash,
        storageDocumentId: Number(storageDocId),
        verificationDocumentId: Number(verificationDocId)
      };

      // Update progress tracking. Uses the full "tx_…" id: user_management
      // keys members by it, so the stripped numeric id never matched.
      if (transactionId) {
        try {
          const backendDocName = getBackendDocumentName(documentName);
          if (backendDocName) {
            // Via the service wrapper, which attaches the CSRF token the method requires.
            const progressUpdated =
              await icpService.updateMemberDocuments(transactionId, backendDocName);
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
      try {
        localStorage.setItem(`doc_id_mapping_${storageDocId}`, String(verificationDocId));
      } catch (e) {
        // Ignore mapping save errors
      }

      onUpload(document, file);
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
    await proceedWithRegistration(file);
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

  const getStatusText = (status: DocumentStatus): string => {
    switch (status) {
      case 'required': return 'Required';
      case 'uploaded': return 'Uploaded - Pending Verification';
      case 'verified': return 'Verified';
      case 'rejected': return 'Rejected - Please Re-upload';
      default: return 'Not Uploaded';
    }
  };

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
            existingDocument.status === 'uploaded' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
            existingDocument.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
            'bg-gray-100 dark:bg-slate-800/50 text-gray-800 dark:text-gray-200'
          }`}>
            {getStatusText(existingDocument.status)}
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

        {uploadState.isUploading ? (
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

      <ScanButton
        onFile={(file) => void processFile(file)}
        disabled={disabled || uploadState.isUploading}
      />

      <GoogleDriveButton
        onFiles={(files) => {
          if (files[0]) void processFile(files[0]);
        }}
        disabled={disabled || uploadState.isUploading}
      />

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
