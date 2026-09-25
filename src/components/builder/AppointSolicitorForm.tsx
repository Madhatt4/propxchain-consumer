// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Inline form for appointing / editing a site's solicitor details.
 */

import { useState, useCallback, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { sitesService } from '@/services/sites.service';

interface AppointSolicitorFormProps {
  siteId: string;
  initialFirm: string;
  initialContact: string;
  initialEmail: string;
  onSaved: (firm: string, contact: string, email: string) => void;
  onCancel: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AppointSolicitorForm({
  siteId,
  initialFirm,
  initialContact,
  initialEmail,
  onSaved,
  onCancel,
}: AppointSolicitorFormProps): JSX.Element {
  const [firm, setFirm] = useState(initialFirm);
  const [contact, setContact] = useState(initialContact);
  const [email, setEmail] = useState(initialEmail);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailValid = email.length === 0 || EMAIL_RE.test(email);

  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (!isEmailValid) return;

      setIsSaving(true);
      setError(null);
      try {
        await sitesService.update(siteId, {
          appointed_solicitor_firm: firm || null,
          appointed_solicitor_contact: contact || null,
          appointed_solicitor_email: email || null,
        });
        onSaved(firm, contact, email);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save.');
      } finally {
        setIsSaving(false);
      }
    },
    [siteId, firm, contact, email, isEmailValid, onSaved],
  );

  const inputClasses =
    'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="sol-firm"
          className="block font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]"
        >
          Firm name
        </label>
        <input
          id="sol-firm"
          type="text"
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          placeholder="e.g. Smith & Partners LLP"
          className={`mt-1 ${inputClasses}`}
        />
      </div>

      <div>
        <label
          htmlFor="sol-contact"
          className="block font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]"
        >
          Contact name
        </label>
        <input
          id="sol-contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="e.g. Jane Smith"
          className={`mt-1 ${inputClasses}`}
        />
      </div>

      <div>
        <label
          htmlFor="sol-email"
          className="block font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]"
        >
          Email
        </label>
        <input
          id="sol-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. jane@smithpartners.co.uk"
          className={`mt-1 ${inputClasses}`}
        />
        {!isEmailValid && (
          <p className="mt-1 font-[DM_Sans] text-xs text-red-600 dark:text-red-400">
            Please enter a valid email address.
          </p>
        )}
      </div>

      {error && (
        <p className="font-[DM_Sans] text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !isEmailValid}
          className="inline-flex items-center gap-2 rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}
