import React from 'react';

import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_10_PROMPTS } from '../../../lib/ta6-prompts/section10';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6ParkingType, TA6Section10Parking } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_10_PROMPTS.find((p) => p.ref === ref);
}

// Canonical order (mirrors the ParkingType variant in forms_types.mo) so the
// stored array stays deterministic regardless of tick order.
const PARKING_TYPES: readonly TA6ParkingType[] = [
  'garage',
  'driveway',
  'allocated',
  'on-road',
  'permit',
  'none',
  'other',
];

const PARKING_LABELS: Readonly<Record<TA6ParkingType, string>> = {
  garage: 'Garage',
  driveway: 'Driveway',
  allocated: 'Allocated space',
  'on-road': 'On-road',
  permit: 'Permit parking',
  none: 'None',
  other: 'Other',
};

interface ParkingPickerProps {
  value: TA6ParkingType[];
  onChange: (next: TA6ParkingType[]) => void;
  readOnly: boolean;
}

/** 10.1 tick-all-that-apply parking arrangements. */
const ParkingPicker: React.FC<ParkingPickerProps> = ({ value, onChange, readOnly }) => {
  const toggle = (type: TA6ParkingType): void => {
    onChange(
      value.includes(type)
        ? value.filter((t) => t !== type)
        : PARKING_TYPES.filter((t) => value.includes(t) || t === type),
    );
  };

  return (
    <div role="group" aria-label="10.1 parking arrangements" className="flex flex-wrap gap-x-5 gap-y-2">
      {PARKING_TYPES.map((type) => (
        <label key={type} className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value.includes(type)}
            onChange={() => toggle(type)}
            disabled={readOnly}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {PARKING_LABELS[type]}
        </label>
      ))}
    </div>
  );
};

/** TA6 §10 — Parking (schema: Section10Parking, forms_types.mo). */
export const Section10: React.FC<TA6SectionProps<TA6Section10Parking>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  // Details are prompted for the 'other' arrangement, but existing text is
  // never hidden by unticking (same rule as ResponseField details).
  const showParkingDetails = value.q10_1Arrangements.includes('other') || value.q10_1Details !== null;
  const showConsentSlot =
    value.q10_3EvChargingPoint.answer === 'yes' ||
    value.q10_3InstallConsent.status !== 'not-answered';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PromptHeader refCode="10.1" prompt={promptFor('10.1')} />
        <ParkingPicker
          value={value.q10_1Arrangements}
          onChange={(q10_1Arrangements) => onChange({ ...value, q10_1Arrangements })}
          readOnly={readOnly}
        />
        {showParkingDetails && (
          <OptionalTextField
            id="ta6-10-1-details"
            label="Parking details"
            value={value.q10_1Details}
            onChange={(q10_1Details) => onChange({ ...value, q10_1Details })}
            readOnly={readOnly}
            placeholder="e.g. how the 'other' arrangement works"
          />
        )}
      </div>

      <ResponseField
        refCode="10.2"
        prompt={promptFor('10.2')}
        value={value.q10_2PermitRequired}
        onChange={(q10_2PermitRequired) => onChange({ ...value, q10_2PermitRequired })}
        readOnly={readOnly}
        detailsPlaceholder="How the permit scheme works and what it costs..."
      />

      <ResponseField
        refCode="10.3"
        prompt={promptFor('10.3')}
        value={value.q10_3EvChargingPoint}
        onChange={(q10_3EvChargingPoint) => onChange({ ...value, q10_3EvChargingPoint })}
        readOnly={readOnly}
        detailsPlaceholder="e.g. owned outright, leased or on a subscription..."
      />

      {showConsentSlot && (
        <DocumentSlot
          refCode="10.3.consent"
          prompt={promptFor('10.3.consent')}
          value={value.q10_3InstallConsent}
          onChange={(q10_3InstallConsent) => onChange({ ...value, q10_3InstallConsent })}
          readOnly={readOnly}
          onUpload={uploadFile}
        />
      )}
    </div>
  );
};
