// TA6 §1 contact blocks: the optional company-seller record (present only when
// the seller is a company — maps to the on-chain ?CompanySeller optional) and
// the mandatory solicitor / conveyancer contact record. Also owns the §1
// prompt lookup shared by the other Section01 files.

import React from 'react';

import { OptionalTextField, TextField } from './widgets/TextFields';
import { SECTION_01_PROMPTS } from '../../../lib/ta6-prompts/section01';

import type { TA6PromptEntry } from '../../../lib/ta6-prompts/types';
import type { TA6CompanySeller, TA6SolicitorContact } from '../../../types/ta6.types';

export function section01Prompt(ref: string): TA6PromptEntry | undefined {
  return SECTION_01_PROMPTS.find((entry) => entry.ref === ref);
}

// ---------- Company seller (optional block) ----------

function emptyCompanySeller(): TA6CompanySeller {
  return { companyName: '', companyNumber: '', director: '', countryOfIncorporation: '' };
}

// Concise field labels — the full ADR 0009 prompt sentences read as noise when
// used as grid labels, so the grid carries short labels only.
const COMPANY_FIELDS: ReadonlyArray<{
  field: keyof TA6CompanySeller;
  label: string;
}> = [
  { field: 'companyName', label: 'Company name' },
  { field: 'companyNumber', label: 'Company number' },
  { field: 'director', label: 'Director dealing with the sale' },
  { field: 'countryOfIncorporation', label: 'Country of incorporation' },
];

export interface Section01CompanyProps {
  company: TA6CompanySeller | null;
  onChange: (next: TA6CompanySeller | null) => void;
  readOnly: boolean;
}

export const Section01Company: React.FC<Section01CompanyProps> = ({
  company,
  onChange,
  readOnly,
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-medium text-gray-900">Company seller</h4>
      {!readOnly &&
        (company === null ? (
          <button
            type="button"
            onClick={() => onChange(emptyCompanySeller())}
            className="text-sm text-blue-600 hover:underline"
          >
            Seller is a company — add details
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-red-600 hover:underline"
          >
            Remove company details
          </button>
        ))}
    </div>
    {company === null ? (
      <p className="text-sm text-gray-500">Only needed when the seller is a company.</p>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {COMPANY_FIELDS.map(({ field, label }) => (
          <TextField
            key={field}
            id={`ta6-1-company-${field}`}
            label={label}
            value={company[field]}
            onChange={(next) => onChange({ ...company, [field]: next })}
            readOnly={readOnly}
          />
        ))}
      </div>
    )}
  </div>
);

// ---------- Solicitor / conveyancer contact ----------

const SOLICITOR_TEXT_FIELDS: ReadonlyArray<{
  field: 'firmName' | 'address' | 'postcode' | 'contactName';
  label: string;
}> = [
  { field: 'firmName', label: 'Firm name' },
  { field: 'address', label: 'Firm address' },
  { field: 'postcode', label: 'Firm postcode' },
  { field: 'contactName', label: 'Contact name' },
];

const SOLICITOR_OPTIONAL_FIELDS: ReadonlyArray<{
  field: 'email' | 'phone';
  label: string;
  type: 'email' | 'tel';
}> = [
  { field: 'email', label: 'Contact email (optional)', type: 'email' },
  { field: 'phone', label: 'Contact phone (optional)', type: 'tel' },
];

export interface Section01SolicitorProps {
  solicitor: TA6SolicitorContact;
  onChange: (next: TA6SolicitorContact) => void;
  readOnly: boolean;
}

export const Section01Solicitor: React.FC<Section01SolicitorProps> = ({
  solicitor,
  onChange,
  readOnly,
}) => (
  <div className="space-y-3">
    <h4 className="font-medium text-gray-900">Your solicitor or conveyancer</h4>
    <div className="grid gap-3 sm:grid-cols-2">
      {SOLICITOR_TEXT_FIELDS.map(({ field, label }) => (
        <TextField
          key={field}
          id={`ta6-1-solicitor-${field}`}
          label={label}
          value={solicitor[field]}
          onChange={(next) => onChange({ ...solicitor, [field]: next })}
          readOnly={readOnly}
        />
      ))}
      {SOLICITOR_OPTIONAL_FIELDS.map(({ field, label, type }) => (
        <OptionalTextField
          key={field}
          id={`ta6-1-solicitor-${field}`}
          label={label}
          value={solicitor[field]}
          onChange={(next) => onChange({ ...solicitor, [field]: next })}
          readOnly={readOnly}
          type={type}
        />
      ))}
    </div>
  </div>
);
