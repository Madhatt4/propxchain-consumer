import React from 'react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { DOC_TYPE_CONFIDENCE_AT } from '../../../services/docClassify.service';
import {
  ALTERATION_KIND_FROM_DOC_TYPE,
  TA6_ALTERATION_DOCUMENT_KINDS,
  TA6_ALTERATION_DOCUMENT_KIND_LABELS,
  TA6_ALTERATION_KIND_LABELS,
  tickedAlterationKinds,
} from '../../../types/ta6.alterationDocument';
import type { DocClassification } from '../../../services/docClassify.service';
import type {
  TA6AlterationDocument,
  TA6AlterationDocumentKind,
  TA6AlterationKind,
  TA6AlterationTypes,
} from '../../../types/ta6.types';
import type { TA6UploadFile } from './section-props';

export interface Section05DocumentRowProps {
  /** 0-based position; rows are 5.2.1, 5.2.2, ... */
  index: number;
  value: TA6AlterationDocument;
  /** The 5.1 tick-set, so "relates to" offers only the changes actually ticked. */
  alterations: TA6AlterationTypes;
  onChange: (next: TA6AlterationDocument) => void;
  readOnly: boolean;
  uploadFile?: TA6UploadFile;
}

const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

/**
 * One §5.2 row: what the paperwork is, which 5.1 change it covers, and the
 * slot. A confident doc-classify answer prefills a blank kind; a kind the
 * seller chose is never overwritten.
 */
export const Section05DocumentRow: React.FC<Section05DocumentRowProps> = ({
  index,
  value,
  alterations,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const ref = `5.2.${index + 1}`;
  const ticked = tickedAlterationKinds(alterations);
  // Keep a link to a change that has since been un-ticked visible rather than silently blank.
  const linkOptions = value.relatesTo && !ticked.includes(value.relatesTo) ? [value.relatesTo, ...ticked] : ticked;

  const setKind = (kind: TA6AlterationDocumentKind | null): void =>
    onChange({ ...value, kind, kindDetails: kind === 'other' ? value.kindDetails : null });

  const prefill = (classification: DocClassification): void => {
    if (value.kind !== null || classification.confidence < DOC_TYPE_CONFIDENCE_AT) return;
    const kind = ALTERATION_KIND_FROM_DOC_TYPE[classification.docType];
    if (kind) onChange({ ...value, kind });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          aria-label={`${ref} document kind`}
          value={value.kind ?? ''}
          onChange={(e) => setKind((e.target.value || null) as TA6AlterationDocumentKind | null)}
          disabled={readOnly}
          className={SELECT_CLASS}
        >
          <option value="">Choose what this paperwork is</option>
          {TA6_ALTERATION_DOCUMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {TA6_ALTERATION_DOCUMENT_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        <select
          aria-label={`${ref} relates to`}
          value={value.relatesTo ?? ''}
          onChange={(e) => onChange({ ...value, relatesTo: (e.target.value || null) as TA6AlterationKind | null })}
          disabled={readOnly}
          className={SELECT_CLASS}
        >
          <option value="">Not linked to a change</option>
          {linkOptions.map((kind) => (
            <option key={kind} value={kind}>
              {TA6_ALTERATION_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>
      {value.kind === 'other' && (
        <input
          type="text"
          aria-label={`${ref} other paperwork details`}
          placeholder="What is the paperwork?"
          value={value.kindDetails ?? ''}
          onChange={(e) => onChange({ ...value, kindDetails: e.target.value === '' ? null : e.target.value })}
          readOnly={readOnly}
          className={SELECT_CLASS}
        />
      )}
      <DocumentSlot
        refCode={ref}
        prompt={undefined}
        value={value.document}
        onChange={(document) => onChange({ ...value, document })}
        readOnly={readOnly}
        onUpload={uploadFile}
        onClassified={prefill}
      />
    </div>
  );
};
