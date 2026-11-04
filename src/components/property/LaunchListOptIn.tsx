// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState, type FormEvent } from 'react';

import { addToWaitlist, isValidEmail } from '@/services/waitlist';

import type { CheckedAddress } from './AddressCheckForm';

/**
 * Optional launch-list sign-up, shown only AFTER the report is on screen.
 * Uses the waitlist Worker's existing 'home_mover_report' source, so the
 * visitor gets the same report confirmation email as the homepage form and the
 * Worker needs no change. That email does not carry the report itself (it
 * points at the Download button), so the copy here never promises it does.
 */

type Status = 'idle' | 'submitting' | 'done' | 'error';

interface LaunchListOptInProps {
  address: CheckedAddress;
}

export function LaunchListOptIn({ address }: LaunchListOptInProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isValidEmail(email.trim())) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    setStatus('submitting');
    const result = await addToWaitlist({
      name: null,
      email: email.trim(),
      role: null,
      postcode: address.postcode,
      houseNumber: address.houseNumber,
      source: 'home_mover_report',
    });
    if (result.ok) {
      setStatus('done');
      setMessage('Thanks. You are on the launch list, and a confirmation is on its way.');
    } else {
      setStatus('error');
      setMessage('Something went wrong. Please try again or email info@propxchain.com');
    }
  };

  if (status === 'done') {
    return (
      <p role="status" className="font-[DM_Sans] text-base text-[#0F766E] dark:text-[#5EEAD4]">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Join the launch list">
      <p className="font-[DM_Sans] text-base font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]">
        Keep a copy, and hear when we launch
      </p>
      <p className="mt-1 font-[DM_Sans] text-sm text-[#6B7280] dark:text-[#94A3B8]">
        Use Download on the report to save a PDF. Leaving your email is optional: one launch email, no spam.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="pc-email" className="sr-only">Email address</label>
        <input
          id="pc-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-[#D1D5DB] bg-white px-4 py-3 font-[DM_Sans] text-base dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F1F5F9] sm:max-w-sm"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#0D9488] px-6 py-3 font-[DM_Sans] text-base font-medium text-[#0D9488] hover:bg-[#0D9488] hover:text-white disabled:opacity-60 dark:border-[#14B8A6] dark:text-[#14B8A6]"
        >
          {status === 'submitting' ? 'Joining…' : 'Join the launch list'}
        </button>
      </div>
      {status === 'error' && (
        <p role="alert" className="mt-2 font-[DM_Sans] text-sm text-[#B91C1C] dark:text-[#F87171]">
          {message}
        </p>
      )}
    </form>
  );
}
