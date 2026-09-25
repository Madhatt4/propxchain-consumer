// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Step 4 — Review all fields and create site.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

import type { SiteFormData } from '../SiteCreateWizard';

interface Props {
  form: SiteFormData;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

interface ReviewRowProps {
  label: string;
  value: string;
}

const ReviewRow: React.FC<ReviewRowProps> = ({ label, value }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
    <dt className="min-w-[140px] font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]">
      {label}
    </dt>
    <dd className="font-[DM_Sans] text-sm text-[var(--text-main)]">
      {value || '—'}
    </dd>
  </div>
);

const StepReview: React.FC<Props> = ({ form, onBack, onSubmit, submitting }) => {
  const hasSolicitor = form.solicitorFirm || form.solicitorContact || form.solicitorEmail;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          Review your site
        </h2>
        <p className="mt-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          Check everything looks correct before creating.
        </p>
      </div>

      <dl className="space-y-4 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
        <ReviewRow label="Site name" value={form.name} />
        <ReviewRow label="Postcode" value={form.postcode} />
        <ReviewRow label="Address" value={form.address} />
        <ReviewRow label="Total plots" value={String(form.totalPlots)} />
        <ReviewRow label="Slug" value={form.slug} />

        {hasSolicitor && (
          <>
            <div className="border-t border-[var(--border-color)] pt-4">
              <p className="font-[DM_Sans] text-xs font-semibold text-[var(--text-secondary)]">
                Appointed solicitor
              </p>
            </div>
            {form.solicitorFirm && <ReviewRow label="Firm" value={form.solicitorFirm} />}
            {form.solicitorContact && <ReviewRow label="Contact" value={form.solicitorContact} />}
            {form.solicitorEmail && <ReviewRow label="Email" value={form.solicitorEmail} />}
          </>
        )}
      </dl>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="font-[DM_Sans] text-sm text-[var(--text-secondary)] hover:text-[var(--text-main)]"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Create site'
          )}
        </button>
      </div>
    </div>
  );
};

export default StepReview;
