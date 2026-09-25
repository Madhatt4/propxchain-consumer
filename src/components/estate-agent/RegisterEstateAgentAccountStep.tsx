// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Loader2 } from 'lucide-react';

interface EstateAgentTextFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  hint?: string;
}

/** Presentational labelled input, shared by every field on the account step. */
const EstateAgentTextField: React.FC<EstateAgentTextFieldProps> = ({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  hint,
}) => (
  <div>
    <label htmlFor={id} className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
      {label}
    </label>
    <input
      id={id}
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
    />
    {hint && <p className="mt-1 font-[DM_Sans] text-xs text-[#6B7280]">{hint}</p>}
  </div>
);

interface EstateAgentAccountActionsProps {
  onBack: () => void;
  isLoading: boolean;
}

/** Back / submit button row at the foot of the account form. */
const EstateAgentAccountActions: React.FC<EstateAgentAccountActionsProps> = ({ onBack, isLoading }) => (
  <div className="flex items-center gap-4">
    <button
      type="button"
      onClick={onBack}
      disabled={isLoading}
      className="font-[DM_Sans] text-sm text-[#6B7280] hover:text-[#1A1A1A]"
    >
      ← Back
    </button>
    <button
      type="submit"
      disabled={isLoading}
      className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
    >
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create account'}
    </button>
  </div>
);

interface RegisterEstateAgentAccountStepProps {
  agencyName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  error: string | null;
  isLoading: boolean;
}

/**
 * Step 2 of estate agent signup: account credentials. The three fields
 * render through EstateAgentTextField and the footer through
 * EstateAgentAccountActions so this component stays under the
 * 50-line-per-function limit too.
 */
const RegisterEstateAgentAccountStep: React.FC<RegisterEstateAgentAccountStepProps> = ({
  agencyName,
  email,
  password,
  passwordConfirm,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onSubmit,
  onBack,
  error,
  isLoading,
}) => {
  const fields: EstateAgentTextFieldProps[] = [
    { id: 'ea-signup-email', label: 'Email address', type: 'email', value: email, onChange: onEmailChange, autoComplete: 'email', required: true },
    { id: 'ea-signup-password', label: 'Password', type: 'password', value: password, onChange: onPasswordChange, autoComplete: 'new-password', required: true, hint: 'At least 8 characters.' },
    { id: 'ea-signup-password-confirm', label: 'Confirm password', type: 'password', value: passwordConfirm, onChange: onPasswordConfirmChange, autoComplete: 'new-password', required: true },
  ];

  return (
    <>
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">Create your account.</h1>
      <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280]">We'll send you a verification email to confirm it's you.</p>
      {agencyName && <p className="mt-4 font-[DM_Sans] text-sm text-[#5F8A68]">Signing up as <strong>{agencyName}</strong></p>}

      <form onSubmit={onSubmit} className="mt-10 space-y-6">
        {fields.map((field) => <EstateAgentTextField key={field.id} {...field} />)}
        {error && <div className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626]">{error}</div>}
        <EstateAgentAccountActions onBack={onBack} isLoading={isLoading} />
      </form>
    </>
  );
};

export default RegisterEstateAgentAccountStep;
