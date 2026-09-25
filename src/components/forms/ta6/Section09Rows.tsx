// TA6 §9 row editors — the repeating Right rows (9.1 / 9.4), the
// pence-backed money input (9.2 / 9.5 / 9.9 amounts) and the optional 9.9
// Arrangement record. Sibling of Section09.tsx to respect the 300-line cap.

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { TextField, OptionalTextField } from './widgets/TextFields';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6Arrangement, TA6Right } from '../../../types/ta6.types';

const TEXTAREA_CLASSES =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500';

export interface RightsEditorProps {
  /** Unique DOM id prefix, e.g. 'ta6-q9-1'. */
  idPrefix: string;
  /** Accessible name for the row group, e.g. '9.1 rights'. */
  label: string;
  rights: TA6Right[];
  onChange: (rights: TA6Right[]) => void;
  readOnly: boolean;
}

// Ghost row shown when no rights exist yet — same defaults the Add button
// appends. It joins the form value only on the first keystroke.
const EMPTY_RIGHT: TA6Right = { description: '', overProperty: null };

interface RightRowProps {
  idPrefix: string;
  index: number;
  right: TA6Right;
  readOnly: boolean;
  /** False while the row is the unmaterialised ghost — it cannot be removed. */
  canRemove: boolean;
  onChange: (next: TA6Right) => void;
  onRemove: () => void;
}

const RightRow: React.FC<RightRowProps> = ({
  idPrefix,
  index,
  right,
  readOnly,
  canRemove,
  onChange,
  onRemove,
}) => (
  <div className="p-3 border border-gray-200 rounded-md space-y-3">
    <TextField
      id={`${idPrefix}-right-${index}-description`}
      label={`Right ${index + 1} description`}
      value={right.description}
      onChange={(description) => onChange({ ...right, description })}
      readOnly={readOnly}
      placeholder="e.g. shared driveway with the neighbouring house"
    />
    <OptionalTextField
      id={`${idPrefix}-right-${index}-over-property`}
      label="Which property it affects"
      value={right.overProperty}
      onChange={(overProperty) => onChange({ ...right, overProperty })}
      readOnly={readOnly}
    />
    {!readOnly && canRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
        Remove right {index + 1}
      </button>
    )}
  </div>
);

/** Add/remove editor for the repeating Right rows of 9.1 and 9.4. */
export const RightsEditor: React.FC<RightsEditorProps> = ({
  idPrefix,
  label,
  rights,
  onChange,
  readOnly,
}) => {
  // Ghost row: an open first row renders without a click, but the form value
  // stays [] until the user types (update writes through the ghost). Each
  // RightsEditor instance (9.1, 9.4) carries its own ghost independently.
  const displayRows = rights.length > 0 ? rights : readOnly ? [] : [EMPTY_RIGHT];

  const update = (index: number, next: TA6Right): void => {
    const base = rights.length > 0 ? rights : [EMPTY_RIGHT];
    onChange(base.map((right, i) => (i === index ? next : right)));
  };

  return (
    <div className="space-y-3" role="group" aria-label={label}>
      {displayRows.map((right, index) => (
        <RightRow
          key={index}
          idPrefix={idPrefix}
          index={index}
          right={right}
          readOnly={readOnly}
          canRemove={rights.length > 0}
          onChange={(next) => update(index, next)}
          onRemove={() => onChange(rights.filter((_, i) => i !== index))}
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...rights, { ...EMPTY_RIGHT }])}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add right
        </button>
      )}
    </div>
  );
};

export interface MoneyFieldProps {
  id: string;
  label: string;
  /** On-chain amounts are Nat PENCE; the input displays and edits pounds. */
  pence: number | null;
  onChange: (pence: number | null) => void;
  readOnly: boolean;
}

/** Pounds input over a pence-backed value (£12.50 <-> 1250). */
export const MoneyField: React.FC<MoneyFieldProps> = ({ id, label, pence, onChange, readOnly }) => {
  // Local text keeps in-progress typing ('12.' / '12.5') editable; the parsed
  // pence value is reported per keystroke, invalid input reports nothing.
  const [text, setText] = useState<string>(pence === null ? '' : (pence / 100).toFixed(2));

  const handleChange = (raw: string): void => {
    setText(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const pounds = Number(raw);
    if (Number.isFinite(pounds) && pounds >= 0) onChange(Math.round(pounds * 100));
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-gray-500" aria-hidden="true">
          £
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          disabled={readOnly}
          placeholder="0.00"
          className={`w-40 ${TEXTAREA_CLASSES}`}
        />
      </div>
    </div>
  );
};

export interface ArrangementEditorProps {
  value: TA6Arrangement;
  onChange: (next: TA6Arrangement) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
  /** '9.9.doc' prompt entry for the agreement document slot. */
  documentPrompt: TA6PromptEntry | undefined;
}

/** The 9.9 Arrangement record: description + contribution + agreement copy. */
export const ArrangementEditor: React.FC<ArrangementEditorProps> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
  documentPrompt,
}) => (
  <div className="p-3 border border-gray-200 rounded-md space-y-3">
    <div>
      <label
        htmlFor="ta6-q9-9-description"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Arrangement description
      </label>
      <textarea
        id="ta6-q9-9-description"
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        disabled={readOnly}
        rows={3}
        className={TEXTAREA_CLASSES}
        placeholder="What the arrangement covers and who it is with..."
      />
    </div>
    <MoneyField
      id="ta6-q9-9-amount"
      label="Contribution amount (£)"
      pence={value.contributionAmount}
      onChange={(contributionAmount) => onChange({ ...value, contributionAmount })}
      readOnly={readOnly}
    />
    <DocumentSlot
      refCode="9.9"
      prompt={documentPrompt}
      value={value.document}
      onChange={(document) => onChange({ ...value, document })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
  </div>
);
