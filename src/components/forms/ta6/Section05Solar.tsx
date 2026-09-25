import React from 'react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { SegmentedButtons } from './widgets/SegmentedButtons';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_05_PROMPTS } from '../../../lib/ta6-prompts/section05';
import { emptyDocument } from '../../../types/ta6.types';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6SolarPower } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_05_PROMPTS.find((p) => p.ref === ref);
}

function emptySolarPower(): TA6SolarPower {
  return {
    fitOrSegAgreement: emptyDocument(),
    supplyAgreement: emptyDocument(),
    electricityBill: emptyDocument(),
    installDate: null,
    ownedOutright: null,
    mcsCertificate: emptyDocument(),
  };
}

// ownedOutright is ?Bool on-chain (true = owned outright, false = leased);
// the segmented control maps it through a two-option string vocabulary.
const OWNERSHIP_OPTIONS = ['owned-outright', 'leased'] as const;
type OwnershipChoice = (typeof OWNERSHIP_OPTIONS)[number];
const OWNERSHIP_LABELS: Readonly<Record<OwnershipChoice, string>> = {
  'owned-outright': 'Owned outright',
  leased: 'Leased',
};

function ownershipValue(ownedOutright: boolean | null): string {
  if (ownedOutright === null) return '';
  return ownedOutright ? 'owned-outright' : 'leased';
}

interface SolarDetailsProps {
  value: TA6SolarPower;
  onChange: (next: TA6SolarPower) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

const SolarDetails: React.FC<SolarDetailsProps> = ({ value, onChange, readOnly, uploadFile }) => (
  <div className="pl-4 border-l-2 border-gray-100 space-y-4">
    <DocumentSlot
      refCode="5.6.i"
      prompt={promptFor('5.6.i')}
      value={value.fitOrSegAgreement}
      onChange={(fitOrSegAgreement) => onChange({ ...value, fitOrSegAgreement })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
    <DocumentSlot
      refCode="5.6.ii"
      prompt={promptFor('5.6.ii')}
      value={value.supplyAgreement}
      onChange={(supplyAgreement) => onChange({ ...value, supplyAgreement })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
    <DocumentSlot
      refCode="5.6.iii"
      prompt={promptFor('5.6.iii')}
      value={value.electricityBill}
      onChange={(electricityBill) => onChange({ ...value, electricityBill })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
    <OptionalTextField
      id="ta6-5-6-install-date"
      label="When was the solar system installed?"
      type="date"
      value={value.installDate}
      onChange={(installDate) => onChange({ ...value, installDate })}
      readOnly={readOnly}
    />
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-2">
        Are the panels owned outright or leased?
      </span>
      <SegmentedButtons
        options={OWNERSHIP_OPTIONS}
        labels={OWNERSHIP_LABELS}
        value={ownershipValue(value.ownedOutright)}
        onSelect={(choice) => onChange({ ...value, ownedOutright: choice === 'owned-outright' })}
        disabled={readOnly}
        label="5.6 ownership"
      />
    </div>
    <DocumentSlot
      refCode="5.6.mcs"
      prompt={promptFor('5.6.mcs')}
      value={value.mcsCertificate}
      onChange={(mcsCertificate) => onChange({ ...value, mcsCertificate })}
      readOnly={readOnly}
      onUpload={uploadFile}
    />
  </div>
);

export interface Section05SolarProps {
  value: TA6SolarPower | null;
  onChange: (next: TA6SolarPower | null) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

/**
 * §5.6 optional solar block. q5_6Solar is ?SolarPower on-chain — populated
 * only if a system exists — so the checkbox creates/removes the whole record
 * and the document/date/ownership follow-ups render only while it is present.
 */
export const Section05Solar: React.FC<Section05SolarProps> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => (
  <div className="space-y-3">
    <PromptHeader refCode="5.6" prompt={promptFor('5.6')} />
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        aria-label="5.6 solar panel system present"
        checked={value !== null}
        onChange={(e) => onChange(e.target.checked ? emptySolarPower() : null)}
        disabled={readOnly}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      The property has a solar panel system
    </label>
    {value !== null && (
      <SolarDetails value={value} onChange={onChange} readOnly={readOnly} uploadFile={uploadFile} />
    )}
  </div>
);
