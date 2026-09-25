import React from 'react';

import { ResponseField } from './widgets/ResponseField';
import { SECTION_04_PROMPTS } from '../../../lib/ta6-prompts/section04';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6ResponseValue, TA6Section4Notices } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_04_PROMPTS.find((p) => p.ref === ref);
}

// The three §4 questions are structurally identical TA6Response slots, so a
// key/ref table keeps the render loop mechanical (same pattern as §5).
type Section4ResponseKey = keyof TA6Section4Notices;

const QUESTIONS: readonly { field: Section4ResponseKey; refCode: string }[] = [
  { field: 'q4_1NoticesReceived', refCode: '4.1' },
  { field: 'q4_2NearbyDevelopment', refCode: '4.2' },
  { field: 'q4_3NearbyUseChange', refCode: '4.3' },
];

/** TA6 §4 — Notices and proposals (schema: Section4Notices, forms_types.mo). */
export const Section04: React.FC<TA6SectionProps<TA6Section4Notices>> = ({
  value,
  onChange,
  readOnly,
}) => {
  const setResponse = (key: Section4ResponseKey) => (next: TA6ResponseValue): void => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-6">
      {QUESTIONS.map(({ field, refCode }) => (
        <ResponseField
          key={refCode}
          refCode={refCode}
          prompt={promptFor(refCode)}
          value={value[field]}
          onChange={setResponse(field)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
};
