// TA6 §2 — Boundaries. 2.1 is an array of boundary features (position +
// ownership, where 'not known' is a legitimate legal answer), 2.2 an optional
// free-text description for irregular boundaries (maps to the on-chain ?Text:
// emptied textarea -> null), 2.3 a standard TA6 response.

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import { TextField } from './widgets/TextFields';
import { SECTION_02_PROMPTS } from '../../../lib/ta6-prompts/section02';

import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from '../../../lib/ta6-prompts/types';
import type {
  TA6BoundaryFeature,
  TA6BoundaryOwnership,
  TA6Section2Boundaries,
} from '../../../types/ta6.types';

function section02Prompt(ref: string): TA6PromptEntry | undefined {
  return SECTION_02_PROMPTS.find((entry) => entry.ref === ref);
}

const OWNERSHIP_OPTIONS: readonly TA6BoundaryOwnership[] = [
  'owned-by-seller',
  'shared',
  'owned-by-neighbour',
  'not-known',
];

const OWNERSHIP_LABELS: Readonly<Record<TA6BoundaryOwnership, string>> = {
  'owned-by-seller': "Ours (the seller's)",
  shared: 'Shared',
  'owned-by-neighbour': "A neighbour's",
  'not-known': 'Not known',
};

const SELECT_CLASSES =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500';

// New rows start at 'not-known' — the honest default the form itself allows,
// never a forged positive answer. Doubles as the ghost row shown when no
// features exist yet; it joins the form value only on the first keystroke.
const EMPTY_BOUNDARY_FEATURE: TA6BoundaryFeature = { position: '', ownership: 'not-known' };

interface BoundaryRowProps {
  index: number;
  feature: TA6BoundaryFeature;
  readOnly: boolean;
  /** False while the row is the unmaterialised ghost — it cannot be removed. */
  canRemove: boolean;
  onChange: (next: TA6BoundaryFeature) => void;
  onRemove: () => void;
}

const BoundaryRow: React.FC<BoundaryRowProps> = ({
  index,
  feature,
  readOnly,
  canRemove,
  onChange,
  onRemove,
}) => (
  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end border border-gray-200 rounded-md p-3">
    <TextField
      id={`ta6-2-boundary-${index}-position`}
      label="Boundary"
      value={feature.position}
      onChange={(position) => onChange({ ...feature, position })}
      readOnly={readOnly}
      placeholder="e.g. left, right, rear, front"
    />
    <div>
      <label
        htmlFor={`ta6-2-boundary-${index}-ownership`}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Looked after by
      </label>
      <select
        id={`ta6-2-boundary-${index}-ownership`}
        value={feature.ownership}
        onChange={(e) => onChange({ ...feature, ownership: e.target.value as TA6BoundaryOwnership })}
        disabled={readOnly}
        className={SELECT_CLASSES}
      >
        {OWNERSHIP_OPTIONS.map((ownership) => (
          <option key={ownership} value={ownership}>
            {OWNERSHIP_LABELS[ownership]}
          </option>
        ))}
      </select>
    </div>
    {!readOnly && canRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove boundary feature ${index + 1}`}
        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

interface BoundaryFeaturesEditorProps {
  features: TA6BoundaryFeature[];
  onChange: (next: TA6BoundaryFeature[]) => void;
  readOnly: boolean;
}

const BoundaryFeaturesEditor: React.FC<BoundaryFeaturesEditorProps> = ({
  features,
  onChange,
  readOnly,
}) => {
  // Ghost row: an open first row renders without a click, but the form value
  // stays [] until the user types (the update handler writes through it).
  const displayRows = features.length > 0 ? features : readOnly ? [] : [EMPTY_BOUNDARY_FEATURE];

  const updateRow = (index: number, next: TA6BoundaryFeature): void => {
    const base = features.length > 0 ? features : [EMPTY_BOUNDARY_FEATURE];
    onChange(base.map((f, i) => (i === index ? next : f)));
  };

  return (
    <div className="space-y-3">
      <PromptHeader refCode="2.1" prompt={section02Prompt('2.1')} />
      {displayRows.map((feature, index) => (
        <BoundaryRow
          key={index}
          index={index}
          feature={feature}
          readOnly={readOnly}
          canRemove={features.length > 0}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => onChange(features.filter((_, i) => i !== index))}
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...features, { ...EMPTY_BOUNDARY_FEATURE }])}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add boundary feature
        </button>
      )}
    </div>
  );
};

export const Section02: React.FC<TA6SectionProps<TA6Section2Boundaries>> = ({
  value,
  onChange,
  readOnly,
}) => (
  <div className="space-y-6">
    <BoundaryFeaturesEditor
      features={value.q2_1Features}
      onChange={(q2_1Features) => onChange({ ...value, q2_1Features })}
      readOnly={readOnly}
    />
    <div className="space-y-2">
      <PromptHeader refCode="2.2" prompt={section02Prompt('2.2')} />
      <textarea
        aria-label="2.2 description"
        value={value.q2_2IrregularDescription ?? ''}
        onChange={(e) =>
          onChange({
            ...value,
            q2_2IrregularDescription: e.target.value === '' ? null : e.target.value,
          })
        }
        disabled={readOnly}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
        placeholder="Leave blank if the boundaries are regular"
      />
    </div>
    <ResponseField
      refCode="2.3"
      prompt={section02Prompt('2.3')}
      value={value.q2_3MovedOrAltered}
      onChange={(q2_3MovedOrAltered) => onChange({ ...value, q2_3MovedOrAltered })}
      readOnly={readOnly}
    />
  </div>
);
