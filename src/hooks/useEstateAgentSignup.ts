// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  supabaseAuthService,
  PENDING_ESTATE_AGENT_ORG_KEY,
  PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY,
  type PendingEstateAgentOrg,
} from '../services/supabase.auth.service';
import {
  lookupCompany,
  normalizeCompanyNumber,
  type CompaniesHouseCompany,
} from '../services/companies-house.service';
import type { EstateAgentBusinessDetails } from '../components/estate-agent/RegisterEstateAgentBusinessStep';

export type EstateAgentSignupStep = 'business' | 'account' | 'check-email';

const EMPTY_BUSINESS_DETAILS: EstateAgentBusinessDetails = {
  agencyName: '',
  branch: '',
  redressScheme: '',
  redressNumber: '',
  companyNumber: '',
  chData: null,
  verified: false,
};

function validateEstateAgentBusinessDetails(details: EstateAgentBusinessDetails): string | null {
  if (!details.agencyName.trim()) return 'Agency name is required';
  if (!details.branch.trim()) return 'Branch is required';
  if (!details.redressScheme) return 'Choose your redress scheme';
  if (!details.redressNumber.trim()) return 'Membership number is required';
  if (details.chData?.isActive === false) {
    return 'This company is dissolved on Companies House — fix the number or clear the optional field';
  }
  if (details.companyNumber.trim() && normalizeCompanyNumber(details.companyNumber) === null) {
    return "That doesn't look like a valid Companies House number — fix it or clear the optional field";
  }
  return null;
}

function validateEstateAgentPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return 'Choose a longer password — at least 8 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

interface EstateAgentSignupResult {
  success: boolean;
  errorMessage?: string;
}

/** Builds the pending-org payload and calls supabaseAuthService.signUp. */
async function submitEstateAgentSignup(
  email: string,
  password: string,
  businessDetails: EstateAgentBusinessDetails,
): Promise<EstateAgentSignupResult> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pendingPayload: PendingEstateAgentOrg = {
      name: businessDetails.agencyName,
      branch: businessDetails.branch,
      redress_scheme: businessDetails.redressScheme as 'PRS' | 'TPO',
      redress_number: businessDetails.redressNumber,
      companies_house_number: normalizeCompanyNumber(businessDetails.companyNumber) ?? null,
      companies_house_verified: businessDetails.verified,
      companies_house_data: businessDetails.chData,
    };

    const result = await supabaseAuthService.signUp(email, password, {
      name: businessDetails.agencyName || email,
      role: 'agent',
      [PENDING_ESTATE_AGENT_ORG_KEY]: pendingPayload,
      [PENDING_ESTATE_AGENT_ORG_EXPIRES_KEY]: expiresAt,
    });

    if (result.error) {
      return { success: false, errorMessage: result.error.message || 'Sign up failed. Please try again.' };
    }
    return { success: true };
  } catch (err) {
    console.error('estate agent signup failed:', err);
    return { success: false, errorMessage: 'Sign up failed. Please try again.' };
  }
}

interface CompaniesHouseLookupState {
  chLookupLoading: boolean;
  chLookupRan: boolean;
}

/** Debounced, optional Companies House lookup. */
function useCompaniesHouseLookup(
  companyNumber: string,
  onResult: (result: CompaniesHouseCompany | null) => void,
): CompaniesHouseLookupState {
  const [chLookupLoading, setChLookupLoading] = useState(false);
  const [chLookupRan, setChLookupRan] = useState(false);

  useEffect(() => {
    const normalised = normalizeCompanyNumber(companyNumber);
    if (!normalised) {
      setChLookupRan(false);
      onResult(null);
      return;
    }
    let cancelled = false;
    setChLookupLoading(true);
    const timer = setTimeout(async () => {
      const result = await lookupCompany(normalised);
      if (cancelled) return;
      onResult(result);
      setChLookupRan(true);
      setChLookupLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setChLookupLoading(false);
    };
  }, [companyNumber, onResult]);

  return { chLookupLoading, chLookupRan };
}

interface EstateAgentBusinessState {
  businessDetails: EstateAgentBusinessDetails;
  setBusinessDetails: (v: EstateAgentBusinessDetails) => void;
  businessError: string | null;
  setBusinessError: (v: string | null) => void;
  chLookupLoading: boolean;
  chLookupRan: boolean;
  isDissolved: boolean;
}

/** State + Companies House wiring for the business step. */
function useEstateAgentBusinessState(): EstateAgentBusinessState {
  const [businessDetails, setBusinessDetails] = useState<EstateAgentBusinessDetails>(EMPTY_BUSINESS_DETAILS);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const handleChLookupResult = useCallback((result: CompaniesHouseCompany | null): void => {
    setBusinessDetails((prev) => ({ ...prev, chData: result, verified: result != null && result.isActive }));
  }, []);
  const { chLookupLoading, chLookupRan } = useCompaniesHouseLookup(businessDetails.companyNumber, handleChLookupResult);
  const isDissolved = businessDetails.chData != null && !businessDetails.chData.isActive;

  return { businessDetails, setBusinessDetails, businessError, setBusinessError, chLookupLoading, chLookupRan, isDissolved };
}

interface EstateAgentAccountState {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  passwordConfirm: string;
  setPasswordConfirm: (v: string) => void;
  signupLoading: boolean;
  setSignupLoading: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}

/** State for the account (credentials) step. */
function useEstateAgentAccountState(): EstateAgentAccountState {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm, signupLoading, setSignupLoading, error, setError };
}

export interface EstateAgentSignup {
  step: EstateAgentSignupStep;
  businessDetails: EstateAgentBusinessDetails;
  setBusinessDetails: (v: EstateAgentBusinessDetails) => void;
  businessError: string | null;
  chLookupLoading: boolean;
  chLookupRan: boolean;
  isDissolved: boolean;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  passwordConfirm: string;
  setPasswordConfirm: (v: string) => void;
  error: string | null;
  signupLoading: boolean;
  handleBusinessContinue: () => void;
  handleSignupSubmit: (e: FormEvent) => Promise<void>;
  goToBusiness: () => void;
  goToAccount: () => void;
}

/**
 * All state and behaviour behind RegisterEstateAgentPage's two-step signup
 * flow. Pulled into a hook so the page component itself stays a thin
 * render — every function here (and every function it delegates to) stays
 * under the 50-line-per-function limit.
 */
export function useEstateAgentSignup(): EstateAgentSignup {
  const [step, setStep] = useState<EstateAgentSignupStep>('business');
  const {
    businessDetails, setBusinessDetails, businessError, setBusinessError,
    chLookupLoading, chLookupRan, isDissolved,
  } = useEstateAgentBusinessState();
  const {
    email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm,
    signupLoading, setSignupLoading, error, setError,
  } = useEstateAgentAccountState();

  const handleBusinessContinue = (): void => {
    const validationError = validateEstateAgentBusinessDetails(businessDetails);
    setBusinessError(validationError);
    if (!validationError) setStep('account');
  };

  const handleSignupSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const passwordError = validateEstateAgentPassword(password, passwordConfirm);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setError(null);
    setSignupLoading(true);
    const result = await submitEstateAgentSignup(email, password, businessDetails);
    setSignupLoading(false);
    if (!result.success) {
      setError(result.errorMessage ?? 'Sign up failed. Please try again.');
      return;
    }
    setStep('check-email');
  };

  return {
    step, businessDetails, setBusinessDetails, businessError,
    chLookupLoading, chLookupRan, isDissolved,
    email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm,
    error, signupLoading,
    handleBusinessContinue, handleSignupSubmit,
    goToBusiness: () => setStep('business'),
    goToAccount: () => setStep('account'),
  };
}
