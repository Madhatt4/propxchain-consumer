// TA6 6th edition — §13 Transaction information (schema: core
// forms_types.mo Section13Transaction; wording: ADR 0009 paraphrase bundle).
//
// 13.1/13.2/13.3/13.5/13.6 are yes/no only on the form (verified against the
// 6th-edition PDFs), so those rows constrain the answer options; 13.4 and
// 13.4b keep the default yes/no/not-known set. The 13.7 occupier editor is a
// follow-up for sales NOT with vacant possession (schema comment) and stays
// visible while rows exist so saved data is never hidden by an answer change.
import React from 'react';

import { Section13Occupiers } from './Section13Occupiers';
import { AnswerButtons } from './widgets/AnswerButtons';
import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import { SECTION_13_PROMPTS } from '../../../lib/ta6-prompts/section13';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6AnswerValue, TA6Section13Transaction } from '../../../types/ta6.types';

const prompt = (ref: string): TA6PromptEntry | undefined =>
  SECTION_13_PROMPTS.find((entry) => entry.ref === ref);

const YES_NO: TA6AnswerValue[] = ['yes', 'no'];

interface AnswerRowProps {
  refCode: string;
  value: TA6AnswerValue;
  onChange: (value: TA6AnswerValue) => void;
  readOnly: boolean;
  options?: TA6AnswerValue[];
}

// Standalone TA6Answer question (no details textarea): prompt + buttons.
const AnswerRow: React.FC<AnswerRowProps> = ({ refCode, value, onChange, readOnly, options }) => (
  <div className="space-y-2">
    <PromptHeader refCode={refCode} prompt={prompt(refCode)} />
    <AnswerButtons
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      options={options}
      label={`${refCode} answer`}
    />
  </div>
);

export const Section13: React.FC<TA6SectionProps<TA6Section13Transaction>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const set = <K extends keyof TA6Section13Transaction>(
    key: K,
    next: TA6Section13Transaction[K],
  ): void => onChange({ ...value, [key]: next });

  const showOccupiers = value.q13_5VacantPossession === 'no' || value.q13_7Occupiers.length > 0;

  return (
    <div className="space-y-6">
      <ResponseField
        refCode="13.1"
        prompt={prompt('13.1')}
        value={value.q13_1DependentPurchase}
        onChange={(next) => set('q13_1DependentPurchase', next)}
        readOnly={readOnly}
        options={YES_NO}
        detailsPlaceholder="Details of the dependent purchase, including how far along it is..."
      />
      <ResponseField
        refCode="13.2"
        prompt={prompt('13.2')}
        value={value.q13_2MovingDateRequirements}
        onChange={(next) => set('q13_2MovingDateRequirements', next)}
        readOnly={readOnly}
        options={YES_NO}
        detailsPlaceholder="Dates you need to complete by, or dates that would not work..."
      />
      <AnswerRow
        refCode="13.3"
        value={value.q13_3SellerLivesAtProperty}
        onChange={(answer) => set('q13_3SellerLivesAtProperty', answer)}
        readOnly={readOnly}
        options={YES_NO}
      />
      <ResponseField
        refCode="13.4"
        prompt={prompt('13.4')}
        value={value.q13_4OtherOccupiers17Plus}
        onChange={(next) => set('q13_4OtherOccupiers17Plus', next)}
        readOnly={readOnly}
        detailsPlaceholder="Full names of any occupiers aged 17 or over..."
      />
      <AnswerRow
        refCode="13.4b"
        value={value.q13_4bTenantsOrLodgers}
        onChange={(answer) => set('q13_4bTenantsOrLodgers', answer)}
        readOnly={readOnly}
      />
      <AnswerRow
        refCode="13.5"
        value={value.q13_5VacantPossession}
        onChange={(answer) => set('q13_5VacantPossession', answer)}
        readOnly={readOnly}
        options={YES_NO}
      />
      <AnswerRow
        refCode="13.6"
        value={value.q13_6OccupiersAgreedSignVacate}
        onChange={(answer) => set('q13_6OccupiersAgreedSignVacate', answer)}
        readOnly={readOnly}
        options={YES_NO}
      />
      {showOccupiers && (
        <Section13Occupiers
          occupiers={value.q13_7Occupiers}
          onChange={(rows) => set('q13_7Occupiers', rows)}
          readOnly={readOnly}
          uploadFile={uploadFile}
        />
      )}
    </div>
  );
};
