// TA6 6th edition — §14 Completion (schema: core forms_types.mo
// Section14Completion; wording: ADR 0009 paraphrase bundle).
//
// 14.1 on the form offers yes / no / "no mortgage" — the third box maps to
// 'not-applicable'. Its paraphrase asks for details when the answer is NO,
// so the details textarea logic is inverted relative to the shared
// ResponseField (which shows details on yes) and composed locally instead.
// 14.2 is the three completion-day commitments (yes/no on the form), keyed
// 14.2a/b/c in the prompt bundle.
import React from 'react';

import { AnswerButtons } from './widgets/AnswerButtons';
import { PromptHeader } from './widgets/PromptHeader';
import { SECTION_14_PROMPTS } from '../../../lib/ta6-prompts/section14';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type {
  TA6AnswerValue,
  TA6CompletionCommitments,
  TA6ResponseValue,
  TA6Section14Completion,
} from '../../../types/ta6.types';

const prompt = (ref: string): TA6PromptEntry | undefined =>
  SECTION_14_PROMPTS.find((entry) => entry.ref === ref);

const YES_NO: TA6AnswerValue[] = ['yes', 'no'];

// 'not-applicable' renders as "Not applicable" = the form's "No mortgage" box.
const PROCEEDS_OPTIONS: TA6AnswerValue[] = ['yes', 'no', 'not-applicable'];

const TEXTAREA_CLASSES =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-500 text-gray-900 placeholder:text-gray-400';

interface ProceedsFieldProps {
  value: TA6ResponseValue;
  onChange: (next: TA6ResponseValue) => void;
  readOnly: boolean;
}

// 14.1: details are needed when proceeds will NOT clear the charges, and any
// existing text stays visible so it is never hidden by an answer change.
const ProceedsField: React.FC<ProceedsFieldProps> = ({ value, onChange, readOnly }) => {
  const showDetails = value.answer === 'no' || value.details !== '';

  return (
    <div className="space-y-2">
      <PromptHeader refCode="14.1" prompt={prompt('14.1')} />
      <AnswerButtons
        value={value.answer}
        onChange={(answer) => onChange({ ...value, answer })}
        readOnly={readOnly}
        options={PROCEEDS_OPTIONS}
        label="14.1 answer"
      />
      {showDetails && (
        <textarea
          aria-label="14.1 details"
          value={value.details}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
          disabled={readOnly}
          rows={3}
          className={TEXTAREA_CLASSES}
          placeholder="Details of any mortgage or secured loan the sale will not pay off..."
        />
      )}
    </div>
  );
};

interface CommitmentRowProps {
  refCode: string;
  value: TA6AnswerValue;
  onChange: (value: TA6AnswerValue) => void;
  readOnly: boolean;
}

const CommitmentRow: React.FC<CommitmentRowProps> = ({ refCode, value, onChange, readOnly }) => (
  <div className="space-y-2">
    <PromptHeader refCode={refCode} prompt={prompt(refCode)} />
    <AnswerButtons
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      options={YES_NO}
      label={`${refCode} answer`}
    />
  </div>
);

export const Section14: React.FC<TA6SectionProps<TA6Section14Completion>> = ({
  value,
  onChange,
  readOnly,
}) => {
  const setCommitment = (key: keyof TA6CompletionCommitments, answer: TA6AnswerValue): void =>
    onChange({ ...value, q14_2Commitments: { ...value.q14_2Commitments, [key]: answer } });

  return (
    <div className="space-y-6">
      <ProceedsField
        value={value.q14_1ProceedsClearCharges}
        onChange={(next) => onChange({ ...value, q14_1ProceedsClearCharges: next })}
        readOnly={readOnly}
      />
      <CommitmentRow
        refCode="14.2a"
        value={value.q14_2Commitments.vacantPossession}
        onChange={(answer) => setCommitment('vacantPossession', answer)}
        readOnly={readOnly}
      />
      <CommitmentRow
        refCode="14.2b"
        value={value.q14_2Commitments.removeSellersItems}
        onChange={(answer) => setCommitment('removeSellersItems', answer)}
        readOnly={readOnly}
      />
      <CommitmentRow
        refCode="14.2c"
        value={value.q14_2Commitments.leaveServiceInfo}
        onChange={(answer) => setCommitment('leaveServiceInfo', answer)}
        readOnly={readOnly}
      />
    </div>
  );
};
