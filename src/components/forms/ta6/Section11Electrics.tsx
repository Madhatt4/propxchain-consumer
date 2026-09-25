// TA6 §11 questions 11.1–11.3 — electrical works, certificates and the EICR.
// Split from Section11.tsx to respect the file/function size caps.

import React from 'react';

import { AnswerButtons } from './widgets/AnswerButtons';
import { DocumentSlot } from './widgets/DocumentSlot';
import { PromptHeader } from './widgets/PromptHeader';
import { ResponseField } from './widgets/ResponseField';
import { OptionalTextField } from './widgets/TextFields';
import { SECTION_11_PROMPTS } from '../../../lib/ta6-prompts/section11';
import type { TA6SectionProps } from './section-props';
import type { TA6PromptEntry } from './widgets/types';
import type { TA6Section11Services } from '../../../types/ta6.types';

function promptFor(ref: string): TA6PromptEntry | undefined {
  return SECTION_11_PROMPTS.find((p) => p.ref === ref);
}

type ElectricsProps = TA6SectionProps<TA6Section11Services>;

/** 11.2 — certificates answer + attachment (shown once relevant). */
const CertificatesQuestion: React.FC<ElectricsProps> = ({
  value,
  onChange,
  readOnly,
  uploadFile,
}) => {
  const showDocument =
    value.q11_2ElectricalCertificates === 'yes' || value.q11_2Document.status !== 'not-answered';

  return (
    <div className="space-y-2">
      <PromptHeader refCode="11.2" prompt={promptFor('11.2')} />
      <AnswerButtons
        value={value.q11_2ElectricalCertificates}
        onChange={(q11_2ElectricalCertificates) => onChange({ ...value, q11_2ElectricalCertificates })}
        readOnly={readOnly}
        label="11.2 answer"
      />
      {showDocument && (
        <DocumentSlot
          refCode="11.2.doc"
          prompt={promptFor('11.2.doc')}
          value={value.q11_2Document}
          onChange={(q11_2Document) => onChange({ ...value, q11_2Document })}
          readOnly={readOnly}
          onUpload={uploadFile}
        />
      )}
    </div>
  );
};

/** 11.3 — EICR answer + report date + attachment (shown once relevant). */
const EicrQuestion: React.FC<ElectricsProps> = ({ value, onChange, readOnly, uploadFile }) => {
  const showFollowUp =
    value.q11_3Eicr === 'yes' ||
    value.q11_3Report.status !== 'not-answered' ||
    value.q11_3Date !== null;

  return (
    <div className="space-y-2">
      <PromptHeader refCode="11.3" prompt={promptFor('11.3')} />
      <AnswerButtons
        value={value.q11_3Eicr}
        onChange={(q11_3Eicr) => onChange({ ...value, q11_3Eicr })}
        readOnly={readOnly}
        label="11.3 answer"
      />
      {showFollowUp && (
        <div className="space-y-3">
          <OptionalTextField
            id="ta6-11-3-date"
            label="Date of most recent report"
            type="date"
            value={value.q11_3Date}
            onChange={(q11_3Date) => onChange({ ...value, q11_3Date })}
            readOnly={readOnly}
          />
          <DocumentSlot
            refCode="11.3.doc"
            prompt={promptFor('11.3.doc')}
            value={value.q11_3Report}
            onChange={(q11_3Report) => onChange({ ...value, q11_3Report })}
            readOnly={readOnly}
            onUpload={uploadFile}
          />
        </div>
      )}
    </div>
  );
};

/** TA6 §11.1–11.3 block (schema: Section11Services, forms_types.mo). */
export const Section11Electrics: React.FC<ElectricsProps> = (props) => {
  const { value, onChange, readOnly } = props;

  return (
    <div className="space-y-6">
      <ResponseField
        refCode="11.1"
        prompt={promptFor('11.1')}
        value={value.q11_1ElectricalWorks}
        onChange={(q11_1ElectricalWorks) => onChange({ ...value, q11_1ElectricalWorks })}
        readOnly={readOnly}
        detailsPlaceholder="When the work was done and what it was..."
      />
      <CertificatesQuestion {...props} />
      <EicrQuestion {...props} />
    </div>
  );
};
