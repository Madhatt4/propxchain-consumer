/**
 * DocumentDetailModal - Shows document metadata, blockchain hash, and file verification
 * Used by the conveyancer to view seller document details and verify received files
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { icpService } from '@/services/icp.service';
import { generateFileHash } from '@/utils/hashGenerator';
import { logger } from '@/utils/logger';

interface DocumentProof {
  id: number;
  fileName: string;
  fileHash: string;
  fileSize: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: number;
  storageLocation: string;
  verified: boolean;
}

interface DocumentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    docType: string;
    fileName: string;
    fileHash: string;
    uploadedAt: string;
    verified: boolean;
  };
  sellerEmail?: string;
  propertyAddress?: string;
}

type VerifyState = 'idle' | 'hashing' | 'match' | 'mismatch' | 'error';

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  sellerEmail,
  propertyAddress,
}) => {
  const [proof, setProof] = useState<DocumentProof | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [verifiedHash, setVerifiedHash] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !doc.id) return;
    setVerifyState('idle');
    setVerifiedHash('');
    setProof(null);

    const fetchProof = async (): Promise<void> => {
      setProofLoading(true);
      try {
        const docId = parseInt(doc.id, 10);
        if (!isNaN(docId)) {
          const result = await icpService.getDocumentProof(docId);
          if (result) setProof(result);
        }
      } catch (err) {
        logger.error('Failed to fetch document proof:', err);
      } finally {
        setProofLoading(false);
      }
    };
    fetchProof();
  }, [isOpen, doc.id]);

  const handleFileDrop = useCallback(async (file: File): Promise<void> => {
    setVerifyState('hashing');
    try {
      const hash = await generateFileHash(file);
      setVerifiedHash(hash);
      const onChainHash = (proof?.fileHash || doc.fileHash).toLowerCase();
      setVerifyState(hash.toLowerCase() === onChainHash ? 'match' : 'mismatch');
    } catch (err) {
      logger.error('Hash verification failed:', err);
      setVerifyState('error');
    }
  }, [proof, doc.fileHash]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileDrop(file);
  }, [handleFileDrop]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
  }, [handleFileDrop]);

  const copyHash = useCallback((): void => {
    const hash = proof?.fileHash || doc.fileHash;
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [proof, doc.fileHash]);

  const handleRequestFromSeller = useCallback((): void => {
    const email = sellerEmail || '';
    const subject = encodeURIComponent(`Document Request: ${doc.fileName}`);
    const body = encodeURIComponent(
      `Hi,\n\nI'm the conveyancer handling the sale of ${propertyAddress || 'your property'}.\n\n` +
      `Could you please send me a copy of the following document:\n\n` +
      `  Document: ${doc.fileName}\n` +
      `  Type: ${doc.docType}\n` +
      `  Blockchain Hash: ${proof?.fileHash || doc.fileHash}\n\n` +
      `I will verify the file against the blockchain hash to confirm authenticity.\n\n` +
      `Thank you.`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  }, [sellerEmail, doc, proof, propertyAddress]);

  const displayHash = proof?.fileHash || doc.fileHash;
  const displaySize = proof
    ? formatFileSize(proof.fileSize)
    : null;
  const displayDate = proof
    ? new Date(proof.uploadedAt / 1_000_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : doc.uploadedAt
      ? new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Unknown';
  const isVerified = proof?.verified ?? doc.verified;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
          <DialogDescription>
            View metadata and verify this document against the blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File info */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg">
              {getDocIcon(doc.fileName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {doc.fileName || doc.docType}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDocType(doc.docType)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {displaySize && <span>{displaySize}</span>}
                <span>{displayDate}</span>
              </div>
            </div>
            <div className="flex-shrink-0">
              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  Pending
                </span>
              )}
            </div>
          </div>

          {proofLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              Loading blockchain proof...
            </div>
          )}

          {/* Blockchain hash */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Blockchain Hash (SHA-256)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-900 rounded px-2 py-1.5 font-mono text-gray-700 dark:text-gray-300 break-all">
                {displayHash || (proofLoading ? 'Loading...' : 'Hash not available')}
              </code>
              <button
                onClick={copyHash}
                className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                title="Copy hash"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Hash verification drop zone */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Verify a File
            </label>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <input
                type="file"
                onChange={onFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {verifyState === 'idle' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Drop a file here or click to verify against the blockchain hash
                </p>
              )}
              {verifyState === 'hashing' && (
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  Computing hash...
                </div>
              )}
              {verifyState === 'match' && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Hash matches — document is authentic
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                    {verifiedHash}
                  </p>
                </div>
              )}
              {verifyState === 'mismatch' && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Hash mismatch — document may have been altered
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                    Local: {verifiedHash}
                  </p>
                </div>
              )}
              {verifyState === 'error' && (
                <p className="text-sm text-red-500">Failed to compute hash. Try again.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleRequestFromSeller}
              className="flex-1 h-9 px-3 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Request from Seller
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-9 px-3 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDocType(docType: string): string {
  const labels: Record<string, string> = {
    proof_of_id: 'Proof of Identity',
    title_deeds: 'Title Deeds',
    ta6_property_info: 'TA6 Property Information',
    ta10_fittings: 'TA10 Fittings & Contents',
    ta7_leasehold: 'TA7 Leasehold Information',
    epc: 'Energy Performance Certificate',
    local_authority_search: 'Local Authority Search',
    environmental_search: 'Environmental Search',
    water_drainage_search: 'Water & Drainage Search',
    tr1_transfer: 'TR1 Transfer Deed',
    ap1_application: 'AP1 Application',
    signed_contract: 'Signed Contract',
    completion_statement: 'Completion Statement',
  };
  return labels[docType] || docType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDocIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '\u{1F4C4}';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return '\u{1F5BC}';
  return '\u{1F4CE}';
}

export default DocumentDetailModal;
