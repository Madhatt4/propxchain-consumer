// TA6 §3 — Disputes and complaints. Two standard TA6 responses: existing /
// past disputes (3.1) and anything that could lead to a future dispute (3.2).

import React from 'react';

import { ResponseField } from './widgets/ResponseField';
import { SECTION_03_PROMPTS } from '../../../lib/ta6-prompts/section03';

import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from '../../../lib/ta6-prompts/types';
import type { TA6Section3Disputes } from '../../../types/ta6.types';

function section03Prompt(ref: string): TA6PromptEntry | undefined {
  return SECTION_03_PROMPTS.find((entry) => entry.ref === ref);
}

export const Section03: React.FC<TA6SectionProps<TA6Section3Disputes>> = ({
  value,
  onChange,
  readOnly,
}) => (
  <div className="space-y-6">
    <ResponseField
      refCode="3.1"
      prompt={section03Prompt('3.1')}
      value={value.q3_1ExistingDisputes}
      onChange={(q3_1ExistingDisputes) => onChange({ ...value, q3_1ExistingDisputes })}
      readOnly={readOnly}
    />
    <ResponseField
      refCode="3.2"
      prompt={section03Prompt('3.2')}
      value={value.q3_2PotentialDisputes}
      onChange={(q3_2PotentialDisputes) => onChange({ ...value, q3_2PotentialDisputes })}
      readOnly={readOnly}
    />
  </div>
);
