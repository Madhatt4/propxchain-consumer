// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Buyer name + email entry form for plot reservation.
 */

import { useState, useCallback, type FormEvent } from 'react';

interface ReservePlotFormProps {
  siteId: string;
  plotId: string;
  onComplete: (buyerName: string, buyerEmail: string) => void;
  onCancel: () => void;
}

/** Basic email regex — not exhaustive, just catches obvious typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ReservePlotForm({
  onComplete,
  onCancel,
}: ReservePlotFormProps): JSX.Element {
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: FormEvent): void => {
      e.preventDefault();
      const trimmedName = buyerName.trim();
      const trimmedEmail = buyerEmail.trim().toLowerCase();

      if (!trimmedName) return;

      if (!EMAIL_RE.test(trimmedEmail)) {
        setEmailError('Please enter a valid email address');
        return;
      }

      setEmailError(null);
      onComplete(trimmedName, trimmedEmail);
    },
    [buyerName, buyerEmail, onComplete],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Buyer name */}
      <div>
        <label
          htmlFor="buyer-name"
          className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]"
        >
          Buyer name
        </label>
        <input
          id="buyer-name"
          type="text"
          required
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          placeholder="Jane Smith"
          className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        />
      </div>

      {/* Buyer email */}
      <div>
        <label
          htmlFor="buyer-email"
          className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]"
        >
          Buyer email
        </label>
        <input
          id="buyer-email"
          type="email"
          required
          value={buyerEmail}
          onChange={(e) => {
            setBuyerEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          placeholder="jane@example.com"
          className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        />
        {emailError && (
          <p className="mt-1 font-[DM_Sans] text-xs text-red-600 dark:text-red-400">
            {emailError}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-[#84A98C] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#5F8A68]"
        >
          Reserve
        </button>
      </div>
    </form>
  );
}
