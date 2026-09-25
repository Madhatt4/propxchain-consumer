// TA6 6th edition — §15 Additional information (schema: core forms_types.mo
// Section15AdditionalInfo; wording: ADR 0009 paraphrase bundle).
//
// The consent-disclosure tree referenced from §5/§8.5/§10.3/§11: an
// add/remove list of attachment slots (per-row refs 15.1.1, 15.1.2, ... keep
// accessible labels unique), the three free-text consent lists, and the
// general additional-notes field (synthetic ref '15.notes' — no number on
// the form). List textareas map '' to null, mirroring the on-chain ?Text.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { SECTION_15_PROMPTS } from '../../../lib/ta6-prompts/section15';
import { emptyDocument } from '../../../types/ta6.defaults';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6DocumentValue, TA6Section15AdditionalInfo } from '../../../types/ta6.types';

const prompt = (ref: string): TA6PromptEntry | undefined =>
  SECTION_15_PROMPTS.find((entry) => entry.ref === ref);

const TEXTAREA_CLASSES =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500';

interface ListFieldProps {
  refCode: string;
  value: string | null;
  onChange: (value: string | null) => void;
  readOnly: boolean;
  rows?: number;
}

// Prompted textarea over `string | null` — an emptied field maps to null.
const ListField: React.FC<ListFieldProps> = ({ refCode, value, onChange, readOnly, rows = 3 }) => (
  <div className="space-y-2">
    <PromptHeader refCode={refCode} prompt={prompt(refCode)} />
    <textarea
      aria-label={`${refCode} text`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      disabled={readOnly}
      rows={rows}
      className={TEXTAREA_CLASSES}
    />
  </div>
);

// Ghost row shown while the array is empty — never mutated, only mapped over.
const EMPTY_ROW: TA6DocumentValue = emptyDocument();

interface ConsentRowProps {
  index: number;
  document: TA6DocumentValue;
  onChange: (next: TA6DocumentValue) => void;
  onRemove: () => void;
  canRemove: boolean;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

const ConsentRow: React.FC<ConsentRowProps> = ({
  index,
  document,
  onChange,
  onRemove,
  canRemove,
  readOnly,
  uploadFile,
}) => (
  <div className="flex items-start gap-2 border border-gray-200 rounded-md p-4">
    <div className="flex-1">
      <DocumentSlot
        refCode={`15.1.${index + 1}`}
        prompt={undefined}
        value={document}
        onChange={onChange}
        readOnly={readOnly}
        onUpload={uploadFile}
      />
    </div>
    {!readOnly && canRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove consent ${index + 1}`}
        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

interface ConsentListProps {
  documents: TA6DocumentValue[];
  onChange: (next: TA6DocumentValue[]) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

const ConsentList: React.FC<ConsentListProps> = ({
  documents,
  onChange,
  readOnly,
  uploadFile,
}) => {
  // Ghost row: an empty editor renders one open slot without a click; form
  // state only materialises on the first edit (write-through below).
  const displayRows = documents.length > 0 ? documents : readOnly ? [] : [EMPTY_ROW];

  const updateRow = (index: number, next: TA6DocumentValue): void => {
    const base = documents.length > 0 ? documents : [EMPTY_ROW];
    onChange(base.map((row, i) => (i === index ? next : row)));
  };

  const removeRow = (index: number): void => onChange(documents.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <PromptHeader refCode="15.1" prompt={prompt('15.1')} />
      {displayRows.map((document, index) => (
        <ConsentRow
          key={index}
          index={index}
          document={document}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => removeRow(index)}
          canRemove={documents.length > 0}
          readOnly={readOnly}
          uploadFile={uploadFile}
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...documents, emptyDocument()])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add consent
        </button>
      )}
    </div>
  );
};

export const Section15: React.FC<TA6SectionProps<TA6Section15AdditionalInfo>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const set = <K extends keyof TA6Section15AdditionalInfo>(
    key: K,
    next: TA6Section15AdditionalInfo[K],
  ): void => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-6">
      <ConsentList
        documents={value.q15_1ConsentsAttached}
        onChange={(next) => set('q15_1ConsentsAttached', next)}
        readOnly={readOnly}
        uploadFile={uploadFile}
      />
      <ListField
        refCode="15.1.attached"
        value={value.consentsAttachedList}
        onChange={(next) => set('consentsAttachedList', next)}
        readOnly={readOnly}
      />
      <ListField
        refCode="15.1.to-follow"
        value={value.consentsToFollowList}
        onChange={(next) => set('consentsToFollowList', next)}
        readOnly={readOnly}
      />
      <ListField
        refCode="15.1.not-available"
        value={value.consentsNotAvailableList}
        onChange={(next) => set('consentsNotAvailableList', next)}
        readOnly={readOnly}
      />
      <ListField
        refCode="15.notes"
        value={value.additionalNotes}
        onChange={(next) => set('additionalNotes', next)}
        readOnly={readOnly}
        rows={4}
      />
    </div>
  );
};
