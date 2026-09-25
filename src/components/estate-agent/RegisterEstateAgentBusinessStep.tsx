// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { CompaniesHouseCompany } from '../../services/companies-house.service';

export interface EstateAgentBusinessDetails {
  agencyName: string;
  branch: string;
  redressScheme: '' | 'PRS' | 'TPO';
  redressNumber: string;
  companyNumber: string;
  chData: CompaniesHouseCompany | null;
  verified: boolean;
}

interface EstateAgentBusinessTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Plain labelled text input, shared by agency name / branch / membership number. */
const EstateAgentBusinessTextField: React.FC<EstateAgentBusinessTextFieldProps> = ({ id, label, value, onChange }) => (
  <div>
    <label htmlFor={id} className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
      {label}
    </label>
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
    />
  </div>
);

interface EstateAgentRedressSchemeFieldProps {
  value: EstateAgentBusinessDetails['redressScheme'];
  onChange: (value: EstateAgentBusinessDetails['redressScheme']) => void;
}

/** Redress scheme select (PRS / TPO). */
const EstateAgentRedressSchemeField: React.FC<EstateAgentRedressSchemeFieldProps> = ({ value, onChange }) => (
  <div>
    <label htmlFor="ea-redress-scheme" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
      Redress scheme
    </label>
    <select
      id="ea-redress-scheme"
      value={value}
      onChange={(e) => onChange(e.target.value as EstateAgentBusinessDetails['redressScheme'])}
      className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
    >
      <option value="">Select a scheme</option>
      <option value="PRS">Property Redress Scheme</option>
      <option value="TPO">The Property Ombudsman</option>
    </select>
  </div>
);

interface EstateAgentCompaniesHouseStatusProps {
  chData: CompaniesHouseCompany | null;
  chLookupRan: boolean;
  companyNumber: string;
  isDissolved: boolean;
}

/** Result cards below the Companies House input: match, no-match, or dissolved. */
const EstateAgentCompaniesHouseStatus: React.FC<EstateAgentCompaniesHouseStatusProps> = ({
  chData,
  chLookupRan,
  companyNumber,
  isDissolved,
}) => (
  <>
    {chData && (
      <div className="mt-4 rounded-md border border-[#0D9488]/30 bg-[#CCFBF1]/30 p-4">
        <p className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A]">{chData.name}</p>
        {chData.incorporatedOn && (
          <p className="mt-1 font-[DM_Sans] text-sm text-[#5F8A68]">
            {chData.isActive ? 'Active' : chData.status} since {chData.incorporatedOn.slice(0, 4)}
          </p>
        )}
      </div>
    )}

    {chLookupRan && !chData && companyNumber && (
      <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#FAFAF8] p-4">
        <p className="font-[DM_Sans] text-sm text-[#6B7280]">
          We couldn't find this company on Companies House. That's fine — it's
          optional and won't block your sign up.
        </p>
      </div>
    )}

    {isDissolved && (
      <div className="mt-4 rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-4">
        <p className="font-[DM_Sans] text-sm text-[#DC2626]">
          This company is marked as <strong>{chData?.status}</strong> on Companies House.
        </p>
      </div>
    )}
  </>
);

interface EstateAgentCompaniesHouseFieldProps {
  companyNumber: string;
  onChange: (value: string) => void;
  chLookupLoading: boolean;
  chLookupRan: boolean;
  chData: CompaniesHouseCompany | null;
  isDissolved: boolean;
}

/** Optional Companies House number input, with live-lookup status below it. */
const EstateAgentCompaniesHouseField: React.FC<EstateAgentCompaniesHouseFieldProps> = ({
  companyNumber,
  onChange,
  chLookupLoading,
  chLookupRan,
  chData,
  isDissolved,
}) => (
  <div>
    <label htmlFor="ea-ch-number" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
      Companies House number (optional)
    </label>
    <div className="relative mt-2">
      <input
        id="ea-ch-number"
        type="text"
        value={companyNumber}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 12345678 or SC123456"
        autoComplete="off"
        className="w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
      />
      {chLookupLoading && (
        <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#5F8A68]" />
      )}
    </div>
    <EstateAgentCompaniesHouseStatus
      chData={chData}
      chLookupRan={chLookupRan}
      companyNumber={companyNumber}
      isDissolved={isDissolved}
    />
  </div>
);

interface RegisterEstateAgentBusinessStepProps {
  value: EstateAgentBusinessDetails;
  onChange: (v: EstateAgentBusinessDetails) => void;
  onContinue: () => void;
  error: string | null;
  chLookupLoading: boolean;
  chLookupRan: boolean;
  isDissolved: boolean;
}

/**
 * Step 1 of estate agent signup: agency identity + redress scheme, with an
 * optional Companies House lookup. Split out of RegisterEstateAgentPage to
 * keep the page under the 300-line limit; the form itself is further
 * factored into small field components so this one stays under the
 * 50-line-per-function limit too.
 */
const RegisterEstateAgentBusinessStep: React.FC<RegisterEstateAgentBusinessStepProps> = ({
  value,
  onChange,
  onContinue,
  error,
  chLookupLoading,
  chLookupRan,
  isDissolved,
}) => {
  const update = (patch: Partial<EstateAgentBusinessDetails>): void => {
    onChange({ ...value, ...patch });
  };

  // Order matters: agency name, branch, THEN redress scheme, THEN membership
  // number — this array only covers the two fields ahead of the scheme
  // select; membership number renders separately, after it.
  const leadingTextFields: (EstateAgentBusinessTextFieldProps & { id: string })[] = [
    { id: 'ea-agency-name', label: 'Agency name', value: value.agencyName, onChange: (v) => update({ agencyName: v }) },
    { id: 'ea-branch', label: 'Branch', value: value.branch, onChange: (v) => update({ branch: v }) },
  ];

  return (
    <>
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">Open your agent portal</h1>
      <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280]">Free listings and sales progression for independent agents.</p>

      <div className="mt-10 space-y-6">
        {leadingTextFields.map((field) => <EstateAgentBusinessTextField key={field.id} {...field} />)}
        <EstateAgentRedressSchemeField value={value.redressScheme} onChange={(v) => update({ redressScheme: v })} />
        <EstateAgentBusinessTextField id="ea-membership-number" label="Membership number" value={value.redressNumber} onChange={(v) => update({ redressNumber: v })} />
        <EstateAgentCompaniesHouseField companyNumber={value.companyNumber} onChange={(v) => update({ companyNumber: v })} chLookupLoading={chLookupLoading} chLookupRan={chLookupRan} chData={value.chData} isDissolved={isDissolved} />
        {error && <div className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626]">{error}</div>}
      </div>

      <div className="mt-10">
        <button type="button" onClick={onContinue} className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]">
          Continue
        </button>
      </div>
    </>
  );
};

export default RegisterEstateAgentBusinessStep;
