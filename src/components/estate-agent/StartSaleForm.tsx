// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Seller name + email entry form for starting a sale — same validation
 * copy pattern as builder/ReservePlotForm.
 */

import { useState, useCallback, type FormEvent } from 'react';

interface StartSaleFormProps {
  isSubmitting: boolean;
  onSubmit: (sellerName: string, sellerEmail: string) => void;
  onCancel: () => void;
}

/** Basic email regex — not exhaustive, just catches obvious typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-[DM_Sans] text-sm text-gray-900 placeholder-gray-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-50 dark:placeholder-gray-500';

interface SellerNameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function SellerNameField({ value, onChange }: SellerNameFieldProps): JSX.Element {
  return (
    <div>
      <label htmlFor="seller-name" className="block font-[DM_Sans] text-sm font-medium text-gray-700 dark:text-gray-300">
        Seller name
      </label>
      <input
        id="seller-name"
        type="text"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jane Smith"
        className={FIELD_CLASS}
      />
    </div>
  );
}

interface SellerEmailFieldProps {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

function SellerEmailField({ value, error, onChange }: SellerEmailFieldProps): JSX.Element {
  return (
    <div>
      <label htmlFor="seller-email" className="block font-[DM_Sans] text-sm font-medium text-gray-700 dark:text-gray-300">
        Seller email
      </label>
      <input
        id="seller-email"
        type="email"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="jane@example.com"
        className={FIELD_CLASS}
      />
      {error && <p className="mt-1 font-[DM_Sans] text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

interface FormActionsProps {
  isSubmitting: boolean;
  onCancel: () => void;
}

function FormActions({ isSubmitting, onCancel }: FormActionsProps): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 font-[DM_Sans] text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-[#84A98C] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#5F8A68] disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Start sale
      </button>
    </div>
  );
}

export default function StartSaleForm({ isSubmitting, onSubmit, onCancel }: StartSaleFormProps): JSX.Element {
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: FormEvent): void => {
      e.preventDefault();
      const trimmedName = sellerName.trim();
      const trimmedEmail = sellerEmail.trim().toLowerCase();
      if (!trimmedName) return;
      if (!EMAIL_RE.test(trimmedEmail)) {
        setEmailError('Please enter a valid email address');
        return;
      }
      setEmailError(null);
      onSubmit(trimmedName, trimmedEmail);
    },
    [sellerName, sellerEmail, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SellerNameField value={sellerName} onChange={setSellerName} />
      <SellerEmailField
        value={sellerEmail}
        error={emailError}
        onChange={(value) => {
          setSellerEmail(value);
          if (emailError) setEmailError(null);
        }}
      />
      <FormActions isSubmitting={isSubmitting} onCancel={onCancel} />
    </form>
  );
}
