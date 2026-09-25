// TA6 6th edition — §9 Rights and informal arrangements.
//
// 9.1–9.3: rights the seller exercises over other property; 9.4–9.6: the
// mirror (rights others exercise over the seller's property — 9.5 is
// contributions ASKED OF other owners, possibly paid to a third party);
// 9.7–9.9: drains, pipes and wires, with 9.9's OPTIONAL Arrangement record
// (add / remove block). Amounts are pence on-chain, pounds in the UI.
// Schema semantics: forms_types.mo (Section9Rights).

import React from 'react';

import { emptyDocument } from '../../../types/ta6.types';
import { SECTION_09_PROMPTS } from '../../../lib/ta6-prompts/section09';
import { ArrangementEditor, MoneyField, RightsEditor } from './Section09Rows';
import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6ResponseValue, TA6Right, TA6Section9Rights } from '../../../types/ta6.types';

const promptFor = (ref: string): TA6PromptEntry | undefined =>
  SECTION_09_PROMPTS.find((entry) => entry.ref === ref);

// 9.1–9.3 and 9.4–9.6 share one shape: rights question + repeating rows,
// contributions question + amount, disagreements question.
interface RightsGroupProps {
  rightsRef: string;
  contributionsRef: string;
  disagreementsRef: string;
  idPrefix: string;
  amountLabel: string;
  rightsResponse: TA6ResponseValue;
  rights: TA6Right[];
  contributions: TA6ResponseValue;
  amount: number | null;
  disagreements: TA6ResponseValue;
  readOnly: boolean;
  onRightsResponse: (next: TA6ResponseValue) => void;
  onRights: (next: TA6Right[]) => void;
  onContributions: (next: TA6ResponseValue) => void;
  onAmount: (next: number | null) => void;
  onDisagreements: (next: TA6ResponseValue) => void;
}

const RightsGroup: React.FC<RightsGroupProps> = (props) => {
  // Editors reveal on 'yes' and stay visible while they hold data.
  const showRights = props.rightsResponse.answer === 'yes' || props.rights.length > 0;
  const showAmount = props.contributions.answer === 'yes' || props.amount !== null;

  return (
    <>
      <ResponseField
        refCode={props.rightsRef}
        prompt={promptFor(props.rightsRef)}
        value={props.rightsResponse}
        onChange={props.onRightsResponse}
        readOnly={props.readOnly}
      />
      {showRights && (
        <RightsEditor
          idPrefix={props.idPrefix}
          label={`${props.rightsRef} rights`}
          rights={props.rights}
          onChange={props.onRights}
          readOnly={props.readOnly}
        />
      )}
      <ResponseField
        refCode={props.contributionsRef}
        prompt={promptFor(props.contributionsRef)}
        value={props.contributions}
        onChange={props.onContributions}
        readOnly={props.readOnly}
      />
      {showAmount && (
        <MoneyField
          id={`${props.idPrefix}-amount`}
          label={props.amountLabel}
          pence={props.amount}
          onChange={props.onAmount}
          readOnly={props.readOnly}
        />
      )}
      <ResponseField
        refCode={props.disagreementsRef}
        prompt={promptFor(props.disagreementsRef)}
        value={props.disagreements}
        onChange={props.onDisagreements}
        readOnly={props.readOnly}
      />
    </>
  );
};

interface ArrangementBlockProps {
  value: TA6Section9Rights;
  patch: (partial: Partial<TA6Section9Rights>) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

/** 9.9 — the arrangement record is optional on-chain: add / remove block. */
const ArrangementBlock: React.FC<ArrangementBlockProps> = ({
  value,
  patch,
  readOnly,
  uploadFile,
}) => (
  <div className="space-y-2">
    <PromptHeader refCode="9.9" prompt={promptFor('9.9')} />
    {value.q9_9Arrangement === null ? (
      !readOnly && (
        <button
          type="button"
          onClick={() =>
            patch({
              q9_9Arrangement: {
                description: '',
                contributionAmount: null,
                document: emptyDocument(),
              },
            })
          }
          className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
        >
          Add arrangement
        </button>
      )
    ) : (
      <>
        <ArrangementEditor
          value={value.q9_9Arrangement}
          onChange={(next) => patch({ q9_9Arrangement: next })}
          readOnly={readOnly}
          uploadFile={uploadFile}
          documentPrompt={promptFor('9.9.doc')}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => patch({ q9_9Arrangement: null })}
            className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50"
          >
            Remove arrangement
          </button>
        )}
      </>
    )}
  </div>
);

interface SliceProps {
  value: TA6Section9Rights;
  patch: (partial: Partial<TA6Section9Rights>) => void;
  readOnly: boolean;
}

/** 9.1–9.3 — rights the seller exercises over other property. */
const SellerRightsGroup: React.FC<SliceProps> = ({ value, patch, readOnly }) => (
  <RightsGroup
    rightsRef="9.1"
    contributionsRef="9.2"
    disagreementsRef="9.3"
    idPrefix="ta6-q9-1"
    amountLabel="Amount you pay (£)"
    rightsResponse={value.q9_1RightsExercised}
    rights={value.q9_1Rights}
    contributions={value.q9_2Contributions}
    amount={value.q9_2Amount}
    disagreements={value.q9_3Disagreements}
    readOnly={readOnly}
    onRightsResponse={(next) => patch({ q9_1RightsExercised: next })}
    onRights={(next) => patch({ q9_1Rights: next })}
    onContributions={(next) => patch({ q9_2Contributions: next })}
    onAmount={(next) => patch({ q9_2Amount: next })}
    onDisagreements={(next) => patch({ q9_3Disagreements: next })}
  />
);

/** 9.4–9.6 — rights others exercise over the seller's property. */
const OthersRightsGroup: React.FC<SliceProps> = ({ value, patch, readOnly }) => (
  <RightsGroup
    rightsRef="9.4"
    contributionsRef="9.5"
    disagreementsRef="9.6"
    idPrefix="ta6-q9-4"
    amountLabel="Amount you ask for (£)"
    rightsResponse={value.q9_4OthersRights}
    rights={value.q9_4Rights}
    contributions={value.q9_5ContributionsReceived}
    amount={value.q9_5Amount}
    disagreements={value.q9_6Disagreements}
    readOnly={readOnly}
    onRightsResponse={(next) => patch({ q9_4OthersRights: next })}
    onRights={(next) => patch({ q9_4Rights: next })}
    onContributions={(next) => patch({ q9_5ContributionsReceived: next })}
    onAmount={(next) => patch({ q9_5Amount: next })}
    onDisagreements={(next) => patch({ q9_6Disagreements: next })}
  />
);

export const Section09: React.FC<TA6SectionProps<TA6Section9Rights>> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const patch = (partial: Partial<TA6Section9Rights>): void =>
    onChange({ ...value, ...partial });

  return (
    <div className="space-y-6">
      <SellerRightsGroup value={value} patch={patch} readOnly={readOnly} />
      <OthersRightsGroup value={value} patch={patch} readOnly={readOnly} />
      <ResponseField
        refCode="9.7"
        prompt={promptFor('9.7')}
        value={value.q9_7CrossingOtherProperty}
        onChange={(next) => patch({ q9_7CrossingOtherProperty: next })}
        readOnly={readOnly}
      />
      <ResponseField
        refCode="9.8"
        prompt={promptFor('9.8')}
        value={value.q9_8LeadingToOthers}
        onChange={(next) => patch({ q9_8LeadingToOthers: next })}
        readOnly={readOnly}
      />
      <ArrangementBlock value={value} patch={patch} readOnly={readOnly} uploadFile={uploadFile} />
    </div>
  );
};
