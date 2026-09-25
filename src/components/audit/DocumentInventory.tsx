/**
 * Document Inventory — shows uploaded documents with hash verification
 */

import React, { useState, useCallback } from 'react';
import { FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useThemeClasses } from '../../hooks/useThemeClasses';
import { icpService } from '../../services/icp.service';
import { logger } from '@/utils/logger';
import type { DocumentAuditEntry } from '../../services/transactionAudit';

interface DocumentInventoryProps {
  documents: DocumentAuditEntry[];
}

type VerifyState = 'idle' | 'verifying' | 'pass' | 'fail';

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(ns: number): string {
  const ms = ns > 1e15 ? ns / 1_000_000 : ns;
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const DocumentInventory: React.FC<DocumentInventoryProps> = ({ documents }) => {
  const theme = useThemeClasses();
  const [verifyStates, setVerifyStates] = useState<Record<number, VerifyState>>({});

  const handleVerify = useCallback(async (doc: DocumentAuditEntry): Promise<void> => {
    if (verifyStates[doc.id] === 'verifying') return;

    setVerifyStates(prev => ({ ...prev, [doc.id]: 'verifying' }));
    try {
      const actor = icpService.documentStorageActor;
      if (!actor) throw new Error('Document storage actor not available');

      // verifyDocumentHash is CSRF-protected on document_storage; without the
      // token the canister rejects the call.
      await actor.verifyDocumentHash(
        BigInt(doc.id),
        doc.fileHash,
        await icpService.getDocumentStorageCsrfToken()
      );
      setVerifyStates(prev => ({ ...prev, [doc.id]: 'pass' }));
    } catch (err) {
      logger.error('Hash verification failed', { docId: doc.id, error: err });
      setVerifyStates(prev => ({ ...prev, [doc.id]: 'fail' }));
    }
  }, [verifyStates]);

  if (documents.length === 0) {
    return (
      <div className={`text-center py-8 ${theme.textTertiary}`}>
        No documents uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map(doc => {
        const state = verifyStates[doc.id] ?? 'idle';
        return (
          <div
            key={doc.id}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg ${theme.cardSecondary}`}
          >
            <FileText className="w-5 h-5 text-teal-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${theme.textPrimary}`}>
                {doc.fileName}
              </p>
              <p className="text-xs font-geist-mono text-gray-500 dark:text-slate-400">
                {truncateHash(doc.fileHash)}
              </p>
              <p className={`text-xs ${theme.textTertiary}`}>
                {doc.docType} &middot; {formatBytes(doc.fileSize)} &middot; {formatDate(doc.uploadedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {state === 'pass' && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              {state === 'fail' && (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {state === 'verifying' && (
                <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
              )}
              <button
                type="button"
                disabled={state === 'verifying'}
                onClick={() => handleVerify(doc)}
                className={`text-xs px-3 py-2.5 min-h-[44px] rounded-md font-medium transition-colors ${
                  state === 'verifying'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                Verify Hash
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DocumentInventory;
