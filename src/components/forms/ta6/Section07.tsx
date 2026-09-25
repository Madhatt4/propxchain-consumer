// TA6 6th edition — §7 Insurance.
//
// 7.1 is a bare yes/no answer with a conditional free-text follow-up (who
// insures, when not seller-insured); 7.2 and 7.3 are standard answer +
// details responses. Schema semantics: forms_types.mo (Section7Insurance);
// wording: ADR 0009 paraphrase bundle (src/lib/ta6-prompts/section07).

import React from 'react';

import { SECTION_07_PROMPTS } from '../../../lib/ta6-prompts/section07';
import { AnswerButtons } from './widgets/AnswerButtons';
import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import { OptionalTextField } from './widgets/TextFields';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6Section7Insurance } from '../../../types/ta6.types';

const promptFor = (ref: string): TA6PromptEntry | undefined =>
  SECTION_07_PROMPTS.find((entry) => entry.ref === ref);

interface InsurerQuestionProps {
  value: TA6Section7Insurance;
  patch: (partial: Partial<TA6Section7Insurance>) => void;
  readOnly: boolean;
}

/** 7.1 — yes/no (the seller knows who arranges cover, so no 'not known'). */
const InsurerQuestion: React.FC<InsurerQuestionProps> = ({ value, patch, readOnly }) => {
  // The follow-up stays visible while it holds text, so an answer change
  // never hides existing data (same convention as ResponseField details).
  const showWhoInsures = value.q7_1DoYouInsure === 'no' || value.q7_1WhoInsuresIfNot !== null;
  const whoInsures = promptFor('7.1.who-insures');

  return (
    <div className="space-y-2">
      <PromptHeader refCode="7.1" prompt={promptFor('7.1')} />
      <AnswerButtons
        value={value.q7_1DoYouInsure}
        onChange={(answer) => patch({ q7_1DoYouInsure: answer })}
        readOnly={readOnly}
        options={['yes', 'no']}
        label="7.1 answer"
      />
      {showWhoInsures && (
        <div>
          <OptionalTextField
            id="ta6-q7-1-who-insures"
            label={whoInsures?.prompt ?? 'If you do not insure the property, who does?'}
            value={value.q7_1WhoInsuresIfNot}
            onChange={(next) => patch({ q7_1WhoInsuresIfNot: next })}
            readOnly={readOnly}
            placeholder="e.g. the freeholder or management company"
          />
          {whoInsures?.helpText && (
            <p className="mt-1 text-xs text-gray-500">{whoInsures.helpText}</p>
          )}
        </div>
      )}
    </div>
  );
};

export const Section07: React.FC<TA6SectionProps<TA6Section7Insurance>> = ({
  value,
  onChange,
  readOnly,
}) => {
  const patch = (partial: Partial<TA6Section7Insurance>): void =>
    onChange({ ...value, ...partial });

  return (
    <div className="space-y-6">
      <InsurerQuestion value={value} patch={patch} readOnly={readOnly} />
      <ResponseField
        refCode="7.2"
        prompt={promptFor('7.2')}
        value={value.q7_2DifficultOrSpecialConditions}
        onChange={(next) => patch({ q7_2DifficultOrSpecialConditions: next })}
        readOnly={readOnly}
        detailsPlaceholder="e.g. refused cover, a high premium or excess, special conditions..."
      />
      <ResponseField
        refCode="7.3"
        prompt={promptFor('7.3')}
        value={value.q7_3Claims}
        onChange={(next) => patch({ q7_3Claims: next })}
        readOnly={readOnly}
        detailsPlaceholder="What happened, when, and whether the claim was paid..."
      />
    </div>
  );
};
