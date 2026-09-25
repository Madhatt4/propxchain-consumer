// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Step 2 — Plot count and optional solicitor appointment.
 */

import React from 'react';

import type { SiteFormData } from '../SiteCreateWizard';

interface Props {
  form: SiteFormData;
  updateForm: (patch: Partial<SiteFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const StepDetails: React.FC<Props> = ({ form, updateForm, onNext, onBack }) => {
  const canContinue = form.totalPlots >= 1;

  const isEmailValid = !form.solicitorEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.solicitorEmail);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          Site details
        </h2>
        <p className="mt-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          How many plots, and have you appointed a solicitor?
        </p>
      </div>

      {/* Total plots */}
      <div>
        <label htmlFor="total-plots" className="block font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
          Total plot count
        </label>
        <input
          id="total-plots"
          type="number"
          min={1}
          value={form.totalPlots}
          onChange={(e) => updateForm({ totalPlots: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          className="mt-2 w-full max-w-[200px] rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-base text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        />
      </div>

      {/* Solicitor appointment (optional) */}
      <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
        <h3 className="font-[DM_Sans] text-sm font-semibold text-[var(--text-main)]">
          Appointed solicitor
          <span className="ml-2 font-normal text-[var(--text-secondary)]">(optional)</span>
        </h3>
        <p className="mt-1 font-[DM_Sans] text-xs text-[var(--text-secondary)]">
          If you have already appointed a solicitor for this development, add their details here.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="sol-firm" className="block font-[DM_Sans] text-xs font-medium text-[var(--text-main)]">
              Firm name
            </label>
            <input
              id="sol-firm"
              type="text"
              value={form.solicitorFirm}
              onChange={(e) => updateForm({ solicitorFirm: e.target.value })}
              placeholder="e.g. Smith & Partners LLP"
              className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-sm text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
            />
          </div>
          <div>
            <label htmlFor="sol-contact" className="block font-[DM_Sans] text-xs font-medium text-[var(--text-main)]">
              Contact name
            </label>
            <input
              id="sol-contact"
              type="text"
              value={form.solicitorContact}
              onChange={(e) => updateForm({ solicitorContact: e.target.value })}
              placeholder="e.g. Jane Smith"
              className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-sm text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
            />
          </div>
          <div>
            <label htmlFor="sol-email" className="block font-[DM_Sans] text-xs font-medium text-[var(--text-main)]">
              Email
            </label>
            <input
              id="sol-email"
              type="email"
              value={form.solicitorEmail}
              onChange={(e) => updateForm({ solicitorEmail: e.target.value })}
              placeholder="e.g. jane@smithpartners.co.uk"
              className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-sm text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
            />
            {!isEmailValid && (
              <p className="mt-1 font-[DM_Sans] text-xs text-[#DC2626]">Please enter a valid email</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="font-[DM_Sans] text-sm text-[var(--text-secondary)] hover:text-[var(--text-main)]"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue || !isEmailValid}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default StepDetails;
