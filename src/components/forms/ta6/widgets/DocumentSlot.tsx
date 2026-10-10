import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Paperclip } from 'lucide-react';

import { PromptHeader } from './PromptHeader';
import { SegmentedButtons } from './SegmentedButtons';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_OPTIONS } from './types';
import type { TA6PromptEntry, TA6DocumentStatusChoice } from './types';
import type { TA6Upload } from './ta6Uploader';
import type { DocClassification, DocFinding, DocScanContext } from '../../../../services/docClassify.service';
import type { TA6DocumentValue } from '../../../../types/ta6.types';

export interface DocumentSlotProps {
  /** TA6 question reference, e.g. '4.2'. */
  refCode: string;
  /** Paraphrased prompt from the wording bundle; undefined renders the ref chip only. */
  prompt: TA6PromptEntry | undefined;
  value: TA6DocumentValue;
  onChange: (value: TA6DocumentValue) => void;
  readOnly?: boolean;
  /** Resolves a picked file to its documentId plus an advisory line — wire via makeTa6Uploader. */
  onUpload?: (file: File, context?: DocScanContext) => Promise<TA6Upload>;
  /** What the upload was classified as, once known. Advisory: never called for a failed classification. */
  onClassified?: (classification: DocClassification) => void;
  /**
   * The TA6 slot this is (5.2 paperwork or 6.1 guarantee) and what the form
   * says about it. Sent with the upload so the consents scan runs; a change
   * to it after an upload re-runs the scan on the same file.
   */
  scanContext?: DocScanContext;
}

interface AttachedControlsProps {
  refCode: string;
  documentId: string | null;
  readOnly: boolean;
  onUpload?: (file: File, context?: DocScanContext) => Promise<TA6Upload>;
  onUploaded: (documentId: string) => void;
  onClassified?: (classification: DocClassification) => void;
  scanContext?: DocScanContext;
}

interface FindingsListProps {
  refCode: string;
  findings: DocFinding[];
}

/** What the consents scan found worth saying, one amber line each. Nothing is shown for a clean document. */
const FindingsList: React.FC<FindingsListProps> = ({ refCode, findings }) => {
  if (findings.length === 0) return null;
  return (
    <ul aria-label={`${refCode} findings`} className="basis-full space-y-1">
      {findings.map((finding) => (
        <li key={finding.key} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {finding.label}
        </li>
      ))}
    </ul>
  );
};

const AttachedControls: React.FC<AttachedControlsProps> = ({
  refCode,
  documentId,
  readOnly,
  onUpload,
  onUploaded,
  onClassified,
  scanContext,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [findings, setFindings] = useState<DocFinding[]>([]);
  // Which pick the pending advisory belongs to: a late answer about an
  // earlier file must not overwrite the line for the file now attached.
  const pickSeq = useRef(0);
  // The re-scan handle for the file uploaded in this session, if any. A slot
  // restored from the saved form has none: its stored findings are read by
  // "Check my answers" instead.
  const rescan = useRef<TA6Upload['rescan']>(undefined);
  const contextKey = scanContext ? JSON.stringify(scanContext) : null;
  const lastScannedKey = useRef<string | null>(contextKey);
  // The classification lands a render or two after the id, so the callbacks
  // captured at pick time would see the row as it was before the id landed.
  const latest = useRef({ onUploaded, onClassified });
  latest.current = { onUploaded, onClassified };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    const seq = ++pickSeq.current;
    setIsUploading(true);
    setUploadError(null);
    setAdvisory(null);
    setFindings([]);
    try {
      const upload = scanContext ? await onUpload(file, scanContext) : await onUpload(file);
      latest.current.onUploaded(upload.documentId);
      rescan.current = upload.rescan;
      lastScannedKey.current = contextKey;
      upload.findings?.then(
        (found) => {
          if (found && pickSeq.current === seq) setFindings(found);
        },
        () => undefined,
      );
      // Advisory only: it lands after the id and a failure shows nothing.
      upload.advisory.then(
        (line) => {
          if (pickSeq.current === seq) setAdvisory(line);
        },
        () => undefined,
      );
      upload.classification.then(
        (classification) => {
          if (classification && pickSeq.current === seq) latest.current.onClassified?.(classification);
        },
        () => undefined,
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // The seller changed the kind or the link after uploading: the scan's
  // answers were about the old context, so ask again about the same file.
  useEffect(() => {
    if (!rescan.current || contextKey === null || contextKey === lastScannedKey.current || !scanContext) return;
    lastScannedKey.current = contextKey;
    const seq = pickSeq.current;
    rescan.current(scanContext).then(
      (found) => {
        if (found && pickSeq.current === seq) setFindings(found);
      },
      () => undefined,
    );
  }, [contextKey, scanContext]);

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
      {advisory && (
        <span className="basis-full text-xs text-gray-500 dark:text-slate-400">{advisory}</span>
      )}
      <FindingsList refCode={refCode} findings={findings} />
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
  onClassified,
  scanContext,
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
          onClassified={onClassified}
          scanContext={scanContext}
        />
      )}
    </div>
  );
};
