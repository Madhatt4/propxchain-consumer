// §13.7 occupier list editor — one row per non-seller occupier (full name,
// age, tenancy-agreement DocumentSlot). Age is ?Nat on-chain, so an emptied
// input maps to null. Each row's DocumentSlot follows the 13.7.doc prompt
// under a per-row ref (13.7.1, 13.7.2, ...) so accessible labels stay unique.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { TextField } from './widgets/TextFields';
import { SECTION_13_PROMPTS } from '../../../lib/ta6-prompts/section13';
import { emptyDocument } from '../../../types/ta6.defaults';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6Occupier } from '../../../types/ta6.types';

const prompt = (ref: string): TA6PromptEntry | undefined =>
  SECTION_13_PROMPTS.find((entry) => entry.ref === ref);

const AGE_INPUT_CLASSES =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500';

const parseAge = (raw: string): number | null => {
  if (raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
};

const emptyOccupier = (): TA6Occupier => ({
  fullName: '',
  age: null,
  tenancyAgreement: emptyDocument(),
});

// Ghost row shown while the array is empty — never mutated, only mapped over.
const EMPTY_ROW: TA6Occupier = emptyOccupier();

interface OccupierRowProps {
  index: number;
  occupier: TA6Occupier;
  onChange: (next: TA6Occupier) => void;
  onRemove: () => void;
  canRemove: boolean;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

const OccupierRow: React.FC<OccupierRowProps> = ({
  index,
  occupier,
  onChange,
  onRemove,
  canRemove,
  readOnly,
  uploadFile,
}) => (
  <div className="border border-gray-200 rounded-md p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">Occupier {index + 1}</span>
      {!readOnly && canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove occupier ${index + 1}`}
          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <TextField
        id={`ta6-13-7-name-${index}`}
        label="Full name"
        value={occupier.fullName}
        onChange={(fullName) => onChange({ ...occupier, fullName })}
        readOnly={readOnly}
      />
      <div>
        <label
          htmlFor={`ta6-13-7-age-${index}`}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Age
        </label>
        <input
          id={`ta6-13-7-age-${index}`}
          type="number"
          min={0}
          value={occupier.age ?? ''}
          onChange={(e) => onChange({ ...occupier, age: parseAge(e.target.value) })}
          disabled={readOnly}
          className={AGE_INPUT_CLASSES}
        />
      </div>
    </div>
    <DocumentSlot
      refCode={`13.7.${index + 1}`}
      prompt={prompt('13.7.doc')}
      value={occupier.tenancyAgreement}
      onChange={(tenancyAgreement) => onChange({ ...occupier, tenancyAgreement })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
  </div>
);

export interface Section13OccupiersProps {
  occupiers: TA6Occupier[];
  onChange: (next: TA6Occupier[]) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

export const Section13Occupiers: React.FC<Section13OccupiersProps> = ({
  occupiers,
  onChange,
  readOnly,
  uploadFile,
}) => {
  // Ghost row: an empty editor renders one open row without a click; form
  // state only materialises on the first keystroke (write-through below).
  const displayRows = occupiers.length > 0 ? occupiers : readOnly ? [] : [EMPTY_ROW];

  const updateRow = (index: number, next: TA6Occupier): void => {
    const base = occupiers.length > 0 ? occupiers : [EMPTY_ROW];
    onChange(base.map((row, i) => (i === index ? next : row)));
  };

  const removeRow = (index: number): void => onChange(occupiers.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <PromptHeader refCode="13.7" prompt={prompt('13.7')} />
      {displayRows.map((occupier, index) => (
        <OccupierRow
          key={index}
          index={index}
          occupier={occupier}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => removeRow(index)}
          canRemove={occupiers.length > 0}
          readOnly={readOnly}
          uploadFile={uploadFile}
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...occupiers, emptyOccupier()])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add occupier
        </button>
      )}
    </div>
  );
};
