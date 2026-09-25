import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';

import { PromptHeader } from './PromptHeader';
import { SegmentedButtons } from './SegmentedButtons';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_OPTIONS } from './types';
import type { TA6PromptEntry, TA6DocumentStatusChoice } from './types';
import type { TA6DocumentValue } from '../../../../types/ta6.types';

export interface DocumentSlotProps {
  /** TA6 question reference, e.g. '4.2'. */
  refCode: string;
  /** Paraphrased prompt from the wording bundle; undefined renders the ref chip only. */
  prompt: TA6PromptEntry | undefined;
  value: TA6DocumentValue;
  onChange: (value: TA6DocumentValue) => void;
  readOnly?: boolean;
  /** Resolves a picked file to a document_storage documentId — wire via makeTa6Uploader. */
  onUpload?: (file: File) => Promise<string>;
}

interface AttachedControlsProps {
  refCode: string;
  documentId: string | null;
  readOnly: boolean;
  onUpload?: (file: File) => Promise<string>;
  onUploaded: (documentId: string) => void;
}

const AttachedControls: React.FC<AttachedControlsProps> = ({
  refCode,
  documentId,
  readOnly,
  onUpload,
  onUploaded,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      onUploaded(await onUpload(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {documentId && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          {`Document attached (#${documentId})`}
        </span>
      )}
      {!readOnly && onUpload && (
        <input
          type="file"
          aria-label={`${refCode} attachment`}
          onChange={handleFile}
          disabled={isUploading}
          className="text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 file:transition-colors hover:file:bg-gray-200 dark:text-slate-400 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700"
        />
      )}
      {isUploading && (
        <span className="text-sm font-medium text-teal-600 dark:text-teal-400">Uploading...</span>
      )}
      {uploadError && <span className="text-sm text-red-600">{uploadError}</span>}
    </div>
  );
};

/**
 * TA6 attachment slot: attached / to follow / not applicable / not available.
 * On-chain invariant: documentId is non-null exactly when status is
 * 'attached', so moving away from 'attached' clears the id.
 */
export const DocumentSlot: React.FC<DocumentSlotProps> = ({
  refCode,
  prompt,
  value,
  onChange,
  readOnly = false,
  onUpload,
}) => {
  const handleStatus = (status: TA6DocumentStatusChoice): void => {
    onChange(
      status === 'attached'
        ? { status, documentId: value.documentId }
        : { status, documentId: null },
    );
  };

  return (
    <div className="space-y-3">
      <PromptHeader refCode={refCode} prompt={prompt} />
      <SegmentedButtons
        options={DOCUMENT_STATUS_OPTIONS}
        labels={DOCUMENT_STATUS_LABELS}
        value={value.status}
        onSelect={handleStatus}
        disabled={readOnly}
        label={`${refCode} document status`}
      />
      {value.status === 'attached' && (
        <AttachedControls
          refCode={refCode}
          documentId={value.documentId}
          readOnly={readOnly}
          onUpload={onUpload}
          onUploaded={(documentId) => onChange({ status: 'attached', documentId })}
        />
      )}
    </div>
  );
};
