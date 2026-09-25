// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Step 3 — Slug generation + uniqueness check.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { sitesService, generateSlug } from '@/services/sites.service';

import type { SiteFormData } from '../SiteCreateWizard';

interface Props {
  form: SiteFormData;
  updateForm: (patch: Partial<SiteFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

const StepSlug: React.FC<Props> = ({ form, updateForm, onNext, onBack }) => {
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [alternatives, setAlternatives] = useState<string[]>([]);

  const checkSlug = useCallback(async (slug: string): Promise<void> => {
    if (!slug) {
      setSlugStatus('idle');
      setAlternatives([]);
      return;
    }
    setSlugStatus('checking');
    try {
      const isAvailable = await sitesService.checkSlugAvailable(slug);
      if (isAvailable) {
        setSlugStatus('available');
        setAlternatives([]);
      } else {
        setSlugStatus('taken');
        // Generate alternatives
        const alts: string[] = [];
        for (let i = 2; i <= 5; i++) {
          const alt = `${slug}-${i}`;
          const altAvailable = await sitesService.checkSlugAvailable(alt);
          if (altAvailable) {
            alts.push(alt);
            if (alts.length >= 3) break;
          }
        }
        setAlternatives(alts);
      }
    } catch {
      setSlugStatus('idle');
    }
  }, []);

  // Debounced slug check on change
  useEffect(() => {
    const slug = form.slug.trim();
    if (!slug) return;
    const timer = setTimeout(() => { checkSlug(slug); }, 500);
    return () => { clearTimeout(timer); };
  }, [form.slug, checkSlug]);

  const handleSlugChange = (value: string): void => {
    updateForm({ slug: generateSlug(value) });
  };

  const selectAlternative = (alt: string): void => {
    updateForm({ slug: alt });
    setSlugStatus('available');
    setAlternatives([]);
  };

  const canContinue = form.slug.length > 0 && slugStatus === 'available';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          Choose a URL slug
        </h2>
        <p className="mt-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          This will appear in the public URL for your development site.
        </p>
      </div>

      <div>
        <label htmlFor="site-slug" className="block font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
          Slug
        </label>
        <div className="relative mt-2">
          <input
            id="site-slug"
            type="text"
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="e.g. meadow-view-park"
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-base text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
          {slugStatus === 'checking' && (
            <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#0D9488]" />
          )}
        </div>

        {form.slug && (
          <p className="mt-1 font-[DM_Sans] text-xs text-[var(--text-secondary)]">
            propxchain.com/sites/<strong>{form.slug}</strong>
          </p>
        )}

        {slugStatus === 'available' && (
          <p className="mt-2 font-[DM_Sans] text-xs text-[#0D9488]">
            This slug is available
          </p>
        )}

        {slugStatus === 'taken' && (
          <div className="mt-2">
            <p className="font-[DM_Sans] text-xs text-[#DC2626]">
              This slug is already taken.
            </p>
            {alternatives.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">Try one of these:</p>
                {alternatives.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => selectAlternative(alt)}
                    className="mr-2 inline-flex rounded-md border border-[#0D9488]/30 bg-[#CCFBF1]/30 px-3 py-1 font-[DM_Sans] text-xs text-[#0D9488] hover:bg-[#CCFBF1]/60"
                  >
                    {alt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
          disabled={!canContinue}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default StepSlug;
