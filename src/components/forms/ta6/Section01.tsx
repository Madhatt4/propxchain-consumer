// TA6 §1 — Property and seller details. Factual fields only (no yes/no legal
// answers): address / postcode / UPRN are prefill-friendly plain text fields,
// then the sellers array editor, an optional company-seller block, and the
// solicitor contact block. Prompts come from the ADR 0009 paraphrase bundle
// (§1 prompts are field labels, keyed by synthetic '1.<fieldPath>' refs).

import React from 'react';

import { Section01Company, Section01Solicitor, section01Prompt } from './Section01Contacts';
import { Section01Sellers } from './Section01Sellers';
import { OptionalTextField, TextField } from './widgets/TextFields';

import type { TA6SectionProps } from './section-props';
import type { TA6Section1PropertyAndSeller } from '../../../types/ta6.types';

interface PropertyIdentityFieldsProps {
  value: TA6Section1PropertyAndSeller;
  onChange: (next: TA6Section1PropertyAndSeller) => void;
  readOnly: boolean;
}

// Address / postcode / UPRN. Plain controlled TextFields so the shell can
// prefill them from the transaction's property record before first render.
const PropertyIdentityFields: React.FC<PropertyIdentityFieldsProps> = ({
  value,
  onChange,
  readOnly,
}) => {
  const uprnPrompt = section01Prompt('1.uprn');
  return (
    <div className="space-y-4">
      <TextField
        id="ta6-1-property-address"
        label={section01Prompt('1.propertyAddress')?.prompt ?? 'Property address'}
        value={value.propertyAddress}
        onChange={(propertyAddress) => onChange({ ...value, propertyAddress })}
        readOnly={readOnly}
      />
      <TextField
        id="ta6-1-postcode"
        label={section01Prompt('1.postcode')?.prompt ?? 'Postcode'}
        value={value.postcode}
        onChange={(postcode) => onChange({ ...value, postcode })}
        readOnly={readOnly}
      />
      <div>
        <OptionalTextField
          id="ta6-1-uprn"
          label={uprnPrompt?.prompt ?? 'UPRN'}
          value={value.uprn}
          onChange={(uprn) => onChange({ ...value, uprn })}
          readOnly={readOnly}
        />
        {uprnPrompt?.helpText && (
          <p className="mt-1 text-xs text-gray-500">{uprnPrompt.helpText}</p>
        )}
      </div>
    </div>
  );
};

export const Section01: React.FC<TA6SectionProps<TA6Section1PropertyAndSeller>> = ({
  value,
  onChange,
  readOnly,
}) => (
  <div className="space-y-8">
    <PropertyIdentityFields value={value} onChange={onChange} readOnly={readOnly} />
    <Section01Sellers
      sellers={value.sellers}
      onChange={(sellers) => onChange({ ...value, sellers })}
      readOnly={readOnly}
    />
    <Section01Company
      company={value.sellerCompany}
      onChange={(sellerCompany) => onChange({ ...value, sellerCompany })}
      readOnly={readOnly}
    />
    <Section01Solicitor
      solicitor={value.solicitor}
      onChange={(solicitor) => onChange({ ...value, solicitor })}
      readOnly={readOnly}
    />
  </div>
);
