// TA6 §11.5–11.7 — drainage-to-mains answers, sewerage source and the
// conditional non-mains system detail block (forms_types.mo: q11_7 populated
// only when the source is not mains). Split from Section11.tsx for size caps.

import React from 'react';

import { AnswerButtons } from './widgets/AnswerButtons';
import { PromptHeader } from './widgets/PromptHeader';
import { SegmentedButtons } from './widgets/SegmentedButtons';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_11_PROMPTS } from '../../../lib/ta6-prompts/section11';
import type { TA6PromptEntry } from './widgets/types';
import type {
  TA6AnswerValue,
  TA6DischargeType,
  TA6Section11Services,
  TA6SewerageSource,
  TA6SewerageSystem,
} from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_11_PROMPTS.find((p) => p.ref === ref);
}

const SEWERAGE_SOURCES: readonly TA6SewerageSource[] = [
  'mains', 'septic-tank', 'cesspool', 'sewage-treatment-plant', 'other',
];

const SEWERAGE_LABELS: Readonly<Record<TA6SewerageSource, string>> = {
  mains: 'Mains drains',
  'septic-tank': 'Septic tank',
  cesspool: 'Cesspool',
  'sewage-treatment-plant': 'Sewage treatment plant',
  other: 'Other',
};

const DISCHARGE_TYPES: readonly TA6DischargeType[] = ['ground-water', 'surface-water'];

const DISCHARGE_LABELS: Readonly<Record<TA6DischargeType, string>> = {
  'ground-water': 'Into the ground',
  'surface-water': 'To surface water',
};

function emptySewerageSystem(source: TA6SewerageSource): TA6SewerageSystem {
  return {
    source,
    otherDetails: null,
    location: null,
    lastServiceDate: null,
    dischargeType: null,
    infiltrationSystem: 'not-answered',
    regulationCompliant: 'not-answered',
  };
}

interface AnswerRowProps {
  refCode: string;
  answer: TA6AnswerValue;
  onAnswer: (next: TA6AnswerValue) => void;
  readOnly: boolean;
}

const AnswerRow: React.FC<AnswerRowProps> = ({ refCode, answer, onAnswer, readOnly }) => (
  <div className="space-y-2">
    <PromptHeader refCode={refCode} prompt={promptFor(refCode)} />
    <AnswerButtons value={answer} onChange={onAnswer} readOnly={readOnly} label={`${refCode} answer`} />
  </div>
);

interface SystemFieldsProps {
  system: TA6SewerageSystem;
  onChange: (next: TA6SewerageSystem) => void;
  readOnly: boolean;
}

const Labelled: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-gray-700">{text}</p>
    {children}
  </div>
);

const SewerageTextFields: React.FC<SystemFieldsProps> = ({ system, onChange, readOnly }) => (
  <>
    {system.source === 'other' && (
      <OptionalTextField
        id="ta6-11-7-other"
        label="Other arrangement details"
        value={system.otherDetails}
        onChange={(otherDetails) => onChange({ ...system, otherDetails })}
        readOnly={readOnly}
      />
    )}
    <div className="grid gap-3 sm:grid-cols-2">
      <OptionalTextField
        id="ta6-11-7-location"
        label="Location of the system"
        value={system.location}
        onChange={(location) => onChange({ ...system, location })}
        readOnly={readOnly}
      />
      <OptionalTextField
        id="ta6-11-7-service"
        label="Last emptied or serviced"
        value={system.lastServiceDate}
        onChange={(lastServiceDate) => onChange({ ...system, lastServiceDate })}
        readOnly={readOnly}
        placeholder="MM/YYYY"
      />
    </div>
  </>
);

const SewerageComplianceFields: React.FC<SystemFieldsProps> = ({ system, onChange, readOnly }) => (
  <>
    <Labelled text="Where does it discharge?">
      <SegmentedButtons
        options={DISCHARGE_TYPES}
        labels={DISCHARGE_LABELS}
        value={system.dischargeType ?? ''}
        onSelect={(dischargeType) => onChange({ ...system, dischargeType })}
        disabled={readOnly}
        label="11.7 discharge type"
      />
    </Labelled>
    <Labelled text="Does it have an infiltration (soakaway) system?">
      <AnswerButtons
        value={system.infiltrationSystem}
        onChange={(infiltrationSystem) => onChange({ ...system, infiltrationSystem })}
        readOnly={readOnly}
        label="11.7 infiltration answer"
      />
    </Labelled>
    <Labelled text="Does it comply with the current regulations?">
      <AnswerButtons
        value={system.regulationCompliant}
        onChange={(regulationCompliant) => onChange({ ...system, regulationCompliant })}
        readOnly={readOnly}
        label="11.7 regulation answer"
      />
    </Labelled>
  </>
);

const SewerageSystemFields: React.FC<SystemFieldsProps> = (props) => (
  <div className="space-y-3 rounded-md border border-gray-200 p-4">
    <SewerageTextFields {...props} />
    <SewerageComplianceFields {...props} />
  </div>
);

interface DrainageProps {
  value: TA6Section11Services;
  onChange: (next: TA6Section11Services) => void;
  readOnly: boolean;
}

/** TA6 §11.5a/b + 11.6 source picker + conditional 11.7 system block. */
export const Section11Drainage: React.FC<DrainageProps> = ({ value, onChange, readOnly }) => {
  // Mains needs no 11.7 record; any other source keeps (or creates) one, with
  // its source kept in lockstep with the 11.6 selection.
  const selectSource = (source: TA6SewerageSource): void => {
    const system =
      source === 'mains'
        ? null
        : { ...(value.q11_7SewerageSystem ?? emptySewerageSystem(source)), source };
    onChange({ ...value, q11_6SewerageSource: source, q11_7SewerageSystem: system });
  };

  return (
    <div className="space-y-6">
      <AnswerRow
        refCode="11.5a"
        answer={value.q11_5aFoulWaterMains}
        onAnswer={(q11_5aFoulWaterMains) => onChange({ ...value, q11_5aFoulWaterMains })}
        readOnly={readOnly}
      />
      <AnswerRow
        refCode="11.5b"
        answer={value.q11_5bSurfaceWaterMains}
        onAnswer={(q11_5bSurfaceWaterMains) => onChange({ ...value, q11_5bSurfaceWaterMains })}
        readOnly={readOnly}
      />
      <div className="space-y-2">
        <PromptHeader refCode="11.6" prompt={promptFor('11.6')} />
        <SegmentedButtons
          options={SEWERAGE_SOURCES}
          labels={SEWERAGE_LABELS}
          value={value.q11_6SewerageSource ?? ''}
          onSelect={selectSource}
          disabled={readOnly}
          label="11.6 answer"
        />
      </div>
      {value.q11_7SewerageSystem !== null && (
        <div className="space-y-2">
          <PromptHeader refCode="11.7" prompt={promptFor('11.7')} />
          <SewerageSystemFields
            system={value.q11_7SewerageSystem}
            onChange={(q11_7SewerageSystem) => onChange({ ...value, q11_7SewerageSystem })}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
};
