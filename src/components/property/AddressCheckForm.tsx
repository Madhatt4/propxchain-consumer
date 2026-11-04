// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState, type FormEvent } from 'react';

import { postcodeService } from '@/services/postcodeService';

/**
 * House number + postcode, nothing else. The public property check is
 * deliberately ungated: the report runs on free open-government data, so
 * asking for an email before showing it only costs us the visitor.
 */

export interface CheckedAddress {
  postcode: string;
  houseNumber: string;
}

interface AddressCheckFormProps {
  onCheck: (address: CheckedAddress) => void;
}

function validate(houseNumber: string, postcode: string): string | null {
  if (!houseNumber.trim()) return 'Please enter the house name or number.';
  if (!postcodeService.isValidPostcodeFormat(postcode)) {
    return 'Please enter a full UK postcode, for example SG19 1AB.';
  }
  return null;
}

const INPUT_CLS =
  'w-full rounded-md border border-[#D1D5DB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F1F5F9]';

export function AddressCheckForm({ onCheck }: AddressCheckFormProps): JSX.Element {
  const [houseNumber, setHouseNumber] = useState('');
  const [postcode, setPostcode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const problem = validate(houseNumber, postcode);
    setError(problem);
    if (problem) return;
    onCheck({ postcode: postcodeService.formatPostcode(postcode), houseNumber: houseNumber.trim() });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8" aria-label="Check a property">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="pc-house" className="sr-only">House name or number</label>
          <input
            id="pc-house"
            type="text"
            autoComplete="address-line1"
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
            placeholder="House name or number"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label htmlFor="pc-postcode" className="sr-only">Postcode</label>
          <input
            id="pc-postcode"
            type="text"
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Postcode"
            className={INPUT_CLS}
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
        >
          Check this property
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 font-[DM_Sans] text-sm text-[#B91C1C] dark:text-[#F87171]">
          {error}
        </p>
      )}
    </form>
  );
}
