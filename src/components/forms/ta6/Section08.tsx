// TA6 6th edition — §8 Environmental matters.
//
// Flooding (8.1–8.2), radon (8.3 with 8.3a report / 8.3b action-level
// follow-ups, then standalone 8.4 remedial measures), Green Deal (8.5 +
// current-bill slot) and Japanese knotweed (8.6, 8.7 + survey slot).
// Follow-up slots reveal on 'yes' and stay visible once they hold data, so
// an answer change never hides an attached document. Schema semantics:
// forms_types.mo (Section8Environmental).

import React from 'react';

import { SECTION_08_PROMPTS } from '../../../lib/ta6-prompts/section08';
import { AnswerButtons } from './widgets/AnswerButtons';
import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6Section8Environmental } from '../../../types/ta6.types';

const promptFor = (ref: string): TA6PromptEntry | undefined =>
  SECTION_08_PROMPTS.find((entry) => entry.ref === ref);

interface BlockProps {
  value: TA6Section8Environmental;
  patch: (partial: Partial<TA6Section8Environmental>) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

/** 8.3 radon test + 8.3a/8.3b follow-ups, then standalone 8.4. */
const RadonBlock: React.FC<BlockProps> = ({ value, patch, readOnly, uploadFile }) => {
  const showFollowUps =
    value.q8_3RadonTest.answer === 'yes' ||
    value.q8_3aReport.status !== 'not-answered' ||
    value.q8_3bBelowActionLevel !== 'not-answered';

  return (
    <>
      <ResponseField
        refCode="8.3"
        prompt={promptFor('8.3')}
        value={value.q8_3RadonTest}
        onChange={(next) => patch({ q8_3RadonTest: next })}
        readOnly={readOnly}
        detailsPlaceholder="Test results..."
      />
      {showFollowUps && (
        <>
          <DocumentSlot
            refCode="8.3a"
            prompt={promptFor('8.3a')}
            value={value.q8_3aReport}
            onChange={(next) => patch({ q8_3aReport: next })}
            readOnly={readOnly}
            onUpload={uploadFile}
          />
          <div className="space-y-2">
            <PromptHeader refCode="8.3b" prompt={promptFor('8.3b')} />
            <AnswerButtons
              value={value.q8_3bBelowActionLevel}
              onChange={(answer) => patch({ q8_3bBelowActionLevel: answer })}
              readOnly={readOnly}
              label="8.3b answer"
            />
          </div>
        </>
      )}
      <ResponseField
        refCode="8.4"
        prompt={promptFor('8.4')}
        value={value.q8_4RadonRemedialMeasures}
        onChange={(next) => patch({ q8_4RadonRemedialMeasures: next })}
        readOnly={readOnly}
      />
    </>
  );
};

/** 8.5 Green Deal + current electricity bill when a plan exists. */
const GreenDealBlock: React.FC<BlockProps> = ({ value, patch, readOnly, uploadFile }) => {
  const showBill =
    value.q8_5GreenDeal.answer === 'yes' || value.q8_5CurrentBill.status !== 'not-answered';

  return (
    <>
      <ResponseField
        refCode="8.5"
        prompt={promptFor('8.5')}
        value={value.q8_5GreenDeal}
        onChange={(next) => patch({ q8_5GreenDeal: next })}
        readOnly={readOnly}
        detailsPlaceholder="Details of the Green Deal plan..."
      />
      {showBill && (
        <DocumentSlot
          refCode="8.5"
          prompt={promptFor('8.5.bill')}
          value={value.q8_5CurrentBill}
          onChange={(next) => patch({ q8_5CurrentBill: next })}
          readOnly={readOnly}
          onUpload={uploadFile}
        />
      )}
    </>
  );
};

/** 8.6 knotweed + 8.7 management plan / survey with its document slot. */
const KnotweedBlock: React.FC<BlockProps> = ({ value, patch, readOnly, uploadFile }) => {
  const showSurvey =
    value.q8_7KnotweedSurvey === 'yes' || value.q8_7SurveyDocument.status !== 'not-answered';

  return (
    <>
      <ResponseField
        refCode="8.6"
        prompt={promptFor('8.6')}
        value={value.q8_6JapaneseKnotweed}
        onChange={(next) => patch({ q8_6JapaneseKnotweed: next })}
        readOnly={readOnly}
      />
      <div className="space-y-2">
        <PromptHeader refCode="8.7" prompt={promptFor('8.7')} />
        <AnswerButtons
          value={value.q8_7KnotweedSurvey}
          onChange={(answer) => patch({ q8_7KnotweedSurvey: answer })}
          readOnly={readOnly}
          label="8.7 answer"
        />
      </div>
      {showSurvey && (
        <DocumentSlot
          refCode="8.7"
          prompt={promptFor('8.7.survey')}
          value={value.q8_7SurveyDocument}
          onChange={(next) => patch({ q8_7SurveyDocument: next })}
          readOnly={readOnly}
          onUpload={uploadFile}
        />
      )}
    </>
  );
};

export const Section08: React.FC<TA6SectionProps<TA6Section8Environmental>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const patch = (partial: Partial<TA6Section8Environmental>): void =>
    onChange({ ...value, ...partial });

  return (
    <div className="space-y-6">
      <ResponseField
        refCode="8.1"
        prompt={promptFor('8.1')}
        value={value.q8_1Flooded}
        onChange={(next) => patch({ q8_1Flooded: next })}
        readOnly={readOnly}
        detailsPlaceholder="When it flooded and the type of flooding..."
      />
      <ResponseField
        refCode="8.2"
        prompt={promptFor('8.2')}
        value={value.q8_2FloodDefences}
        onChange={(next) => patch({ q8_2FloodDefences: next })}
        readOnly={readOnly}
      />
      <RadonBlock value={value} patch={patch} readOnly={readOnly} uploadFile={uploadFile} />
      <GreenDealBlock value={value} patch={patch} readOnly={readOnly} uploadFile={uploadFile} />
      <KnotweedBlock value={value} patch={patch} readOnly={readOnly} uploadFile={uploadFile} />
    </div>
  );
};
