// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * SiteCreateWizard — multi-step wizard for creating a new development site.
 * Steps: 1) Name + Address  2) Details  3) Slug  4) Review + Create
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';
import { useMembershipsQuery } from '@/router/useMembershipsQuery';
import { sitesService, generateSlug } from '@/services/sites.service';

import StepNameAddress from './wizard/StepNameAddress';
import StepDetails from './wizard/StepDetails';
import StepSlug from './wizard/StepSlug';
import StepReview from './wizard/StepReview';

export type WizardStep = 1 | 2 | 3 | 4;

export interface SiteFormData {
  name: string;
  postcode: string;
  address: string;
  totalPlots: number;
  solicitorFirm: string;
  solicitorContact: string;
  solicitorEmail: string;
  slug: string;
}

const INITIAL_FORM: SiteFormData = {
  name: '',
  postcode: '',
  address: '',
  totalPlots: 1,
  solicitorFirm: '',
  solicitorContact: '',
  solicitorEmail: '',
  slug: '',
};

const STEP_LABELS = ['Name & Address', 'Details', 'Slug', 'Review'];

const SiteCreateWizard: React.FC = () => {
  const navigate = useNavigate();
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const { data: memberships } = useMembershipsQuery(supabaseUser?.id);

  const devOrg = memberships?.find((m) => m.organisationType === 'developer');

  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<SiteFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateForm = (patch: Partial<SiteFormData>): void => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const goNext = (): void => {
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
  };

  const goBack = (): void => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const handleCreate = async (): Promise<void> => {
    if (!devOrg) {
      setError('No developer organisation found. Please contact support.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sitesService.create({
        organisation_id: devOrg.organisationId,
        name: form.name.trim(),
        slug: form.slug,
        address: form.address.trim(),
        postcode: form.postcode.trim().toUpperCase(),
        total_plots: form.totalPlots,
        appointed_solicitor_firm: form.solicitorFirm.trim() || null,
        appointed_solicitor_contact: form.solicitorContact.trim() || null,
        appointed_solicitor_email: form.solicitorEmail.trim() || null,
      });
      navigate('/builder');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create site.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Auto-generate slug when moving from step 2 to 3 if slug is empty. */
  const handleStepChange = (next: WizardStep): void => {
    if (next === 3 && !form.slug) {
      updateForm({ slug: generateSlug(form.name) });
    }
    setStep(next);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-main)]">
        <div className="mx-auto flex max-w-[800px] items-center justify-between px-6 py-5">
          <h1 className="font-[Fraunces] text-xl font-semibold tracking-tight text-[var(--text-main)]">
            Create a new site
          </h1>
          <button
            type="button"
            onClick={() => navigate('/builder')}
            className="font-[DM_Sans] text-sm text-[var(--text-secondary)] hover:text-[var(--text-main)]"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Step indicator */}
      <div className="mx-auto max-w-[800px] px-6 pt-8">
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && (
                <div className={`h-px flex-1 ${i < step ? 'bg-[#0D9488]' : 'bg-[var(--border-color)]'}`} />
              )}
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  i + 1 <= step
                    ? 'bg-[#0D9488] text-white'
                    : 'bg-[var(--bg-section)] text-[var(--text-secondary)]'
                }`}>
                  {i + 1}
                </div>
                <span className="hidden font-[DM_Sans] text-xs text-[var(--text-secondary)] sm:inline">
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step content */}
      <main className="mx-auto max-w-[800px] px-6 py-10">
        {error && (
          <div className="mb-6 rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        {step === 1 && <StepNameAddress form={form} updateForm={updateForm} onNext={goNext} />}
        {step === 2 && (
          <StepDetails form={form} updateForm={updateForm} onNext={() => handleStepChange(3)} onBack={goBack} />
        )}
        {step === 3 && <StepSlug form={form} updateForm={updateForm} onNext={goNext} onBack={goBack} />}
        {step === 4 && (
          <StepReview form={form} onBack={goBack} onSubmit={handleCreate} submitting={submitting} />
        )}

        {submitting && (
          <div className="mt-6 flex items-center gap-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating your site...
          </div>
        )}
      </main>
    </div>
  );
};

export default SiteCreateWizard;
