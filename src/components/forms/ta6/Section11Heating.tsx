// TA6 §11.4 — heating and hot water systems (multi-instance array editor).
// Split from Section11.tsx to respect the file/function size caps.

import React from 'react';
import { Trash2 } from 'lucide-react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_11_PROMPTS } from '../../../lib/ta6-prompts/section11';
import { emptyDocument } from '../../../types/ta6.types';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6HeatingSystem, TA6HeatingType } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_11_PROMPTS.find((p) => p.ref === ref);
}

const HEATING_TYPES: readonly TA6HeatingType[] = [
  'gas-central', 'oil', 'lpg', 'electric', 'heat-pump-air',
  'heat-pump-ground', 'solid-fuel', 'solar-thermal', 'district-heating', 'other',
];

const HEATING_LABELS: Readonly<Record<TA6HeatingType, string>> = {
  'gas-central': 'Gas central heating',
  oil: 'Oil',
  lpg: 'LPG',
  electric: 'Electric',
  'heat-pump-air': 'Air source heat pump',
  'heat-pump-ground': 'Ground source heat pump',
  'solid-fuel': 'Solid fuel',
  'solar-thermal': 'Solar thermal',
  'district-heating': 'District heating',
  other: 'Other',
};

function emptyHeatingSystem(): TA6HeatingSystem {
  return {
    heatingType: 'gas-central',
    otherDetails: null,
    installDate: null,
    lastServiceDate: null,
    certificate: emptyDocument(),
  };
}

// Ghost row shown while the array is empty — never mutated, only mapped over.
const EMPTY_ROW: TA6HeatingSystem = emptyHeatingSystem();

interface RowProps {
  index: number;
  system: TA6HeatingSystem;
  onChange: (next: TA6HeatingSystem) => void;
  onRemove: () => void;
  canRemove: boolean;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

const HeatingTypeSelect: React.FC<Omit<RowProps, 'onRemove' | 'canRemove' | 'uploadFile'>> = ({
  index,
  system,
  onChange,
  readOnly,
}) => (
  <div>
    <label htmlFor={`ta6-11-4-type-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
      System type
    </label>
    <select
      id={`ta6-11-4-type-${index}`}
      aria-label={`11.4 system ${index + 1} type`}
      value={system.heatingType}
      onChange={(e) => onChange({ ...system, heatingType: e.target.value as TA6HeatingType })}
      disabled={readOnly}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
    >
      {HEATING_TYPES.map((type) => (
        <option key={type} value={type}>
          {HEATING_LABELS[type]}
        </option>
      ))}
    </select>
  </div>
);

const HeatingSystemFields: React.FC<Omit<RowProps, 'onRemove' | 'canRemove' | 'uploadFile'>> = ({
  index,
  system,
  onChange,
  readOnly,
}) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <HeatingTypeSelect index={index} system={system} onChange={onChange} readOnly={readOnly} />
    {system.heatingType === 'other' && (
      <OptionalTextField
        id={`ta6-11-4-other-${index}`}
        label="Other system details"
        value={system.otherDetails}
        onChange={(otherDetails) => onChange({ ...system, otherDetails })}
        readOnly={readOnly}
      />
    )}
    <OptionalTextField
      id={`ta6-11-4-install-${index}`}
      label="Install date"
      type="date"
      value={system.installDate}
      onChange={(installDate) => onChange({ ...system, installDate })}
      readOnly={readOnly}
    />
    <OptionalTextField
      id={`ta6-11-4-service-${index}`}
      label="Last service date"
      type="date"
      value={system.lastServiceDate}
      onChange={(lastServiceDate) => onChange({ ...system, lastServiceDate })}
      readOnly={readOnly}
    />
  </div>
);

const HeatingSystemRow: React.FC<RowProps> = ({
  index,
  system,
  onChange,
  onRemove,
  canRemove,
  readOnly,
  uploadFile,
}) => (
  <div className="rounded-md border border-gray-200 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">System {index + 1}</span>
      {!readOnly && canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove heating system ${index + 1}`}
          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          Remove
        </button>
      )}
    </div>
    <HeatingSystemFields index={index} system={system} onChange={onChange} readOnly={readOnly} />
    <DocumentSlot
      refCode="11.4.doc"
      prompt={promptFor('11.4.doc')}
      value={system.certificate}
      onChange={(certificate) => onChange({ ...system, certificate })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
  </div>
);

export interface HeatingSystemsEditorProps {
  systems: TA6HeatingSystem[];
  onChange: (next: TA6HeatingSystem[]) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

/** TA6 §11.4 array editor — one record per heating/hot-water system. */
export const HeatingSystemsEditor: React.FC<HeatingSystemsEditorProps> = ({
  systems,
  onChange,
  readOnly,
  uploadFile,
}) => {
  // Ghost row: an empty editor renders one open row without a click; form
  // state only materialises on the first edit (write-through below).
  const displayRows = systems.length > 0 ? systems : readOnly ? [] : [EMPTY_ROW];

  const updateRow = (index: number, next: TA6HeatingSystem): void => {
    const base = systems.length > 0 ? systems : [EMPTY_ROW];
    onChange(base.map((s, i) => (i === index ? next : s)));
  };

  return (
    <div className="space-y-3">
      <PromptHeader refCode="11.4" prompt={promptFor('11.4')} />
      {displayRows.map((system, index) => (
        <HeatingSystemRow
          key={index}
          index={index}
          system={system}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => onChange(systems.filter((_, i) => i !== index))}
          canRemove={systems.length > 0}
          readOnly={readOnly}
          uploadFile={uploadFile}
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...systems, emptyHeatingSystem()])}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
        >
          Add heating system
        </button>
      )}
    </div>
  );
};
