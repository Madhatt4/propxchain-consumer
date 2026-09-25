// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { MaterialInfoOverrides } from '@/types/materialInfo.types';

const FLOOD_RISK_OPTIONS = ['Very low', 'Low', 'Medium', 'High'];
const LISTED_BUILDING_OPTIONS = ['None', 'Grade I', 'Grade II*', 'Grade II'];

type OverridesKey = keyof MaterialInfoOverrides;

/** Sets or deletes one key on the overrides object, keeping it free of
 *  `undefined` values so a cleared field disappears entirely. */
function withOverride<K extends OverridesKey>(
  value: MaterialInfoOverrides,
  key: K,
  next: MaterialInfoOverrides[K] | undefined,
): MaterialInfoOverrides {
  const updated = { ...value };
  if (next === undefined) {
    delete updated[key];
  } else {
    updated[key] = next;
  }
  return updated;
}

interface TextFieldRowProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string | undefined) => void;
}

/** Council tax band text input (A–H). Empty input clears the override. */
function TextFieldRow({ id, label, value, onChange }: TextFieldRowProps): JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        maxLength={1}
        value={value}
        onChange={(e) => onChange(e.target.value.trim() === '' ? undefined : e.target.value.toUpperCase())}
        className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2 font-[DM_Sans] text-sm text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
      />
    </div>
  );
}

interface NumberFieldRowProps {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}

/** Numeric input (lease years / ground rent / service charge). Empty input clears the override. */
function NumberFieldRow({ id, label, value, onChange }: NumberFieldRowProps): JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          const parsed = Number(raw);
          onChange(raw === '' || Number.isNaN(parsed) ? undefined : parsed);
        }}
        className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2 font-[DM_Sans] text-sm text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
      />
    </div>
  );
}

interface SelectFieldRowProps {
  id: string;
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (next: string | undefined) => void;
}

/** Dropdown with a blank "Not set" option that clears the override. */
function SelectFieldRow({ id, label, value, options, onChange }: SelectFieldRowProps): JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2 font-[DM_Sans] text-sm text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
      >
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TriStateFieldRowProps {
  id: string;
  label: string;
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
}

/** Three-state conservation-area select: "Not set" clears the override
 *  entirely, while "Yes" and "No" both store an explicit boolean — unlike a
 *  checkbox, this lets an agent record a confirmed "No" rather than only
 *  ever being able to clear back to "Not yet provided". */
function TriStateFieldRow({ id, label, value, onChange }: TriStateFieldRowProps): JSX.Element {
  const selectValue = value === undefined ? '' : value ? 'yes' : 'no';
  return (
    <div>
      <label htmlFor={id} className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
        {label}
      </label>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? undefined : raw === 'yes');
        }}
        className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2 font-[DM_Sans] text-sm text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
      >
        <option value="">Not set</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

export interface MaterialInfoEditorProps {
  value: MaterialInfoOverrides;
  onChange: (next: MaterialInfoOverrides) => void;
}

/** Controlled form for the agent-entered Material Information overrides.
 *  Clearing an input removes its key from the overrides object rather than
 *  leaving an `undefined` value behind. */
export function MaterialInfoEditor({ value, onChange }: MaterialInfoEditorProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextFieldRow
        id="material-info-council-tax-band"
        label="Council tax band"
        value={value.councilTaxBand ?? ''}
        onChange={(next) => onChange(withOverride(value, 'councilTaxBand', next))}
      />
      <SelectFieldRow
        id="material-info-flood-risk"
        label="Flood risk"
        value={value.floodRisk}
        options={FLOOD_RISK_OPTIONS}
        onChange={(next) => onChange(withOverride(value, 'floodRisk', next))}
      />
      <SelectFieldRow
        id="material-info-listed-building"
        label="Listed building"
        value={value.listedBuilding}
        options={LISTED_BUILDING_OPTIONS}
        onChange={(next) => onChange(withOverride(value, 'listedBuilding', next))}
      />
      <TriStateFieldRow
        id="material-info-conservation-area"
        label="Conservation area"
        value={value.conservationArea}
        onChange={(next) => onChange(withOverride(value, 'conservationArea', next))}
      />
      <NumberFieldRow
        id="material-info-lease-years-remaining"
        label="Lease years remaining"
        value={value.leaseYearsRemaining}
        onChange={(next) => onChange(withOverride(value, 'leaseYearsRemaining', next))}
      />
      <NumberFieldRow
        id="material-info-ground-rent"
        label="Ground rent (per year)"
        value={value.groundRentPerYear}
        onChange={(next) => onChange(withOverride(value, 'groundRentPerYear', next))}
      />
      <NumberFieldRow
        id="material-info-service-charge"
        label="Service charge (per year)"
        value={value.serviceChargePerYear}
        onChange={(next) => onChange(withOverride(value, 'serviceChargePerYear', next))}
      />
    </div>
  );
}

export default MaterialInfoEditor;
