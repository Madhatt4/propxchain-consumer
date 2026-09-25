import React from 'react';

import { Section05AlterationTypes } from './Section05AlterationTypes';
import { Section05Documents } from './Section05Documents';
import { Section05Solar } from './Section05Solar';
import { ResponseField } from './widgets/ResponseField';
import { SECTION_05_PROMPTS } from '../../../lib/ta6-prompts/section05';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6ResponseValue, TA6Section5Alterations } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_05_PROMPTS.find((p) => p.ref === ref);
}

// Plain TA6Response questions, split around the 5.6 solar block so the render
// order matches the form. 5.7's details field holds the listing grade.
type Section5ResponseKey =
  | 'q5_3NonResidentialUse'
  | 'q5_4Breaches'
  | 'q5_5UnresolvedIssues'
  | 'q5_7ListedBuilding'
  | 'q5_8ConservationArea'
  | 'q5_9TreePreservationOrder';

interface ResponseQuestion {
  field: Section5ResponseKey;
  refCode: string;
  detailsPlaceholder?: string;
}

const BEFORE_SOLAR: readonly ResponseQuestion[] = [
  { field: 'q5_3NonResidentialUse', refCode: '5.3' },
  { field: 'q5_4Breaches', refCode: '5.4' },
  { field: 'q5_5UnresolvedIssues', refCode: '5.5' },
];

const AFTER_SOLAR: readonly ResponseQuestion[] = [
  { field: 'q5_7ListedBuilding', refCode: '5.7', detailsPlaceholder: 'Listing grade (e.g. Grade II)...' },
  { field: 'q5_8ConservationArea', refCode: '5.8' },
  { field: 'q5_9TreePreservationOrder', refCode: '5.9' },
];

/** TA6 §5 — Alterations (schema: Section5Alterations, forms_types.mo). */
export const Section05: React.FC<TA6SectionProps<TA6Section5Alterations>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const setResponse = (key: Section5ResponseKey) => (next: TA6ResponseValue): void => {
    onChange({ ...value, [key]: next });
  };

  const renderQuestion = ({ field, refCode, detailsPlaceholder }: ResponseQuestion): React.ReactElement => (
    <ResponseField
      key={refCode}
      refCode={refCode}
      prompt={promptFor(refCode)}
      value={value[field]}
      onChange={setResponse(field)}
      readOnly={readOnly}
      detailsPlaceholder={detailsPlaceholder}
    />
  );

  return (
    <div className="space-y-6">
      <Section05AlterationTypes
        value={value.q5_1Alterations}
        onChange={(q5_1Alterations) => onChange({ ...value, q5_1Alterations })}
        readOnly={readOnly}
      />
      <Section05Documents
        value={value.q5_2Documents}
        onChange={(q5_2Documents) => onChange({ ...value, q5_2Documents })}
        readOnly={readOnly}
        uploadFile={uploadFile}
      />
      {BEFORE_SOLAR.map(renderQuestion)}
      <Section05Solar
        value={value.q5_6Solar}
        onChange={(q5_6Solar) => onChange({ ...value, q5_6Solar })}
        readOnly={readOnly}
        uploadFile={uploadFile}
      />
      {AFTER_SOLAR.map(renderQuestion)}
    </div>
  );
};
