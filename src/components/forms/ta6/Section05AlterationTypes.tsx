import React from 'react';

import { PromptHeader } from './widgets/PromptHeader';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_05_PROMPTS } from '../../../lib/ta6-prompts/section05';
import type { TA6AlterationTypes } from '../../../types/ta6.types';

// 5.1 tick-all-that-apply flags (every Bool on AlterationTypes except the
// otherDetails follow-up). Labels are PropXchain paraphrase, not form wording.
type AlterationFlag = Exclude<keyof TA6AlterationTypes, 'otherDetails'>;

const ALTERATION_FLAGS: readonly { field: AlterationFlag; label: string }[] = [
  { field: 'windowsPost2002', label: 'Replacement windows, doors or glazing (fitted since April 2002)' },
  { field: 'conservatory', label: 'Conservatory' },
  { field: 'extension', label: 'Extension' },
  { field: 'loftConversion', label: 'Loft conversion' },
  { field: 'garageConversion', label: 'Garage conversion' },
  { field: 'internalWallsRemoved', label: 'Internal walls removed or altered' },
  { field: 'changeOfUse', label: 'Change of use' },
  { field: 'structuralRoofWorks', label: 'Structural work to the roof' },
  { field: 'other', label: 'Other change' },
];

export interface Section05AlterationTypesProps {
  value: TA6AlterationTypes;
  onChange: (next: TA6AlterationTypes) => void;
  readOnly: boolean;
}

/**
 * §5.1 alteration tick-set. The otherDetails field appears once 'other' is
 * ticked and stays visible while it holds text, so unticking never hides
 * (or silently discards) an existing description.
 */
export const Section05AlterationTypes: React.FC<Section05AlterationTypesProps> = ({
  value,
  onChange,
  readOnly,
}) => (
  <fieldset className="space-y-3">
    <PromptHeader refCode="5.1" prompt={SECTION_05_PROMPTS.find((p) => p.ref === '5.1')} />
    <div className="grid sm:grid-cols-2 gap-2">
      {ALTERATION_FLAGS.map(({ field, label }) => (
        <label key={field} className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value[field]}
            onChange={(e) => onChange({ ...value, [field]: e.target.checked })}
            disabled={readOnly}
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {label}
        </label>
      ))}
    </div>
    {(value.other || value.otherDetails !== null) && (
      <OptionalTextField
        id="ta6-5-1-other-details"
        label="Describe the other change"
        value={value.otherDetails}
        onChange={(otherDetails) => onChange({ ...value, otherDetails })}
        readOnly={readOnly}
      />
    )}
  </fieldset>
);
