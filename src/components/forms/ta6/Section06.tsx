import React from 'react';

import { Section06WarrantyRow } from './Section06WarrantyRow';
import { ResponseField } from './widgets/ResponseField';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_06_PROMPTS } from '../../../lib/ta6-prompts/section06';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6ResponseValue, TA6Section6Guarantees, TA6WarrantyItem } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_06_PROMPTS.find((p) => p.ref === ref);
}

// 6.1 fixed warranty checklist — one row per WarrantyItem field, in form
// order. Ref suffixes match the §6 paraphrase bundle (`<ref>.doc` = slot).
type WarrantyKey =
  | 'q6_1NewHomeWarranty'
  | 'q6_1DampProofing'
  | 'q6_1TimberTreatment'
  | 'q6_1Roofing'
  | 'q6_1ElectricalWork'
  | 'q6_1WindowsDoors'
  | 'q6_1CentralHeating'
  | 'q6_1Underpinning'
  | 'q6_1Other';

const WARRANTY_ROWS: readonly { field: WarrantyKey; refBase: string }[] = [
  { field: 'q6_1NewHomeWarranty', refBase: '6.1.new-home-warranty' },
  { field: 'q6_1DampProofing', refBase: '6.1.damp-proofing' },
  { field: 'q6_1TimberTreatment', refBase: '6.1.timber-treatment' },
  { field: 'q6_1Roofing', refBase: '6.1.roofing' },
  { field: 'q6_1ElectricalWork', refBase: '6.1.electrical-work' },
  { field: 'q6_1WindowsDoors', refBase: '6.1.windows-doors' },
  { field: 'q6_1CentralHeating', refBase: '6.1.central-heating' },
  { field: 'q6_1Underpinning', refBase: '6.1.underpinning' },
  { field: 'q6_1Other', refBase: '6.1.other' },
];

/** TA6 §6 — Guarantees and warranties (schema: Section6Guarantees, forms_types.mo). */
export const Section06: React.FC<TA6SectionProps<TA6Section6Guarantees>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const setWarranty = (key: WarrantyKey) => (next: TA6WarrantyItem): void => {
    onChange({ ...value, [key]: next });
  };

  const setResponse = (field: 'q6_2Claims' | 'q6_3Breaches') => (next: TA6ResponseValue): void => {
    onChange({ ...value, [field]: next });
  };

  const showOtherDetails = value.q6_1Other.present === 'yes' || value.q6_1OtherDetails !== null;

  return (
    <div className="space-y-6">
      <div className="divide-y divide-gray-200">
        {WARRANTY_ROWS.map(({ field, refBase }) => (
          <Section06WarrantyRow
            key={refBase}
            refBase={refBase}
            answerPrompt={promptFor(refBase)}
            documentPrompt={promptFor(`${refBase}.doc`)}
            value={value[field]}
            onChange={setWarranty(field)}
            readOnly={readOnly}
            uploadFile={uploadFile}
          />
        ))}
      </div>
      {showOtherDetails && (
        <OptionalTextField
          id="ta6-6-1-other-details"
          label="What does the other guarantee or warranty cover?"
          value={value.q6_1OtherDetails}
          onChange={(q6_1OtherDetails) => onChange({ ...value, q6_1OtherDetails })}
          readOnly={readOnly}
        />
      )}
      <ResponseField
        refCode="6.2"
        prompt={promptFor('6.2')}
        value={value.q6_2Claims}
        onChange={setResponse('q6_2Claims')}
        readOnly={readOnly}
      />
      <ResponseField
        refCode="6.3"
        prompt={promptFor('6.3')}
        value={value.q6_3Breaches}
        onChange={setResponse('q6_3Breaches')}
        readOnly={readOnly}
      />
    </div>
  );
};
