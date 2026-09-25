// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Step 1 — Site name, postcode lookup, and full address.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { postcodeService } from '@/services/postcodeService';

import type { SiteFormData } from '../SiteCreateWizard';

interface Props {
  form: SiteFormData;
  updateForm: (patch: Partial<SiteFormData>) => void;
  onNext: () => void;
}

const StepNameAddress: React.FC<Props> = ({ form, updateForm, onNext }) => {
  const [postcodeValid, setPostcodeValid] = useState<boolean | null>(null);
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeRegion, setPostcodeRegion] = useState<string | null>(null);

  const lookupPostcode = useCallback(async (pc: string): Promise<void> => {
    if (!postcodeService.isValidPostcodeFormat(pc)) {
      setPostcodeValid(false);
      setPostcodeRegion(null);
      return;
    }
    setPostcodeLoading(true);
    try {
      const result = await postcodeService.lookupPostcode(pc);
      if (result) {
        setPostcodeValid(true);
        const region = [result.admin_district, result.region].filter(Boolean).join(', ');
        setPostcodeRegion(region || null);
        updateForm({ postcode: postcodeService.formatPostcode(pc) });
      } else {
        setPostcodeValid(false);
        setPostcodeRegion(null);
      }
    } catch {
      setPostcodeValid(false);
      setPostcodeRegion(null);
    } finally {
      setPostcodeLoading(false);
    }
  }, [updateForm]);

  // Debounced postcode lookup
  useEffect(() => {
    const trimmed = form.postcode.trim();
    if (trimmed.length < 5) {
      setPostcodeValid(null);
      setPostcodeRegion(null);
      return;
    }
    const timer = setTimeout(() => { lookupPostcode(trimmed); }, 400);
    return () => { clearTimeout(timer); };
  }, [form.postcode, lookupPostcode]);

  const canContinue = form.name.trim().length >= 2
    && postcodeValid === true
    && form.address.trim().length >= 5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          Name and address
        </h2>
        <p className="mt-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          What is this development called and where is it?
        </p>
      </div>

      {/* Site name */}
      <div>
        <label htmlFor="site-name" className="block font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
          Site name
        </label>
        <input
          id="site-name"
          type="text"
          value={form.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          placeholder="e.g. Meadow View Park"
          className="mt-2 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-base text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        />
      </div>

      {/* Postcode */}
      <div>
        <label htmlFor="site-postcode" className="block font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
          Postcode
        </label>
        <div className="relative mt-2">
          <input
            id="site-postcode"
            type="text"
            value={form.postcode}
            onChange={(e) => updateForm({ postcode: e.target.value })}
            placeholder="e.g. MK42 9AB"
            autoComplete="postal-code"
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-base text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
          {postcodeLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#0D9488]" />
          )}
        </div>
        {postcodeValid === true && postcodeRegion && (
          <p className="mt-1 font-[DM_Sans] text-xs text-[#0D9488]">{postcodeRegion}</p>
        )}
        {postcodeValid === false && (
          <p className="mt-1 font-[DM_Sans] text-xs text-[#DC2626]">Postcode not recognised</p>
        )}
      </div>

      {/* Full address */}
      <div>
        <label htmlFor="site-address" className="block font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
          Full address
        </label>
        <textarea
          id="site-address"
          value={form.address}
          onChange={(e) => updateForm({ address: e.target.value })}
          placeholder="Street, town, county"
          rows={3}
          className="mt-2 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 font-[DM_Sans] text-base text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue}
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
      >
        Continue
      </button>
    </div>
  );
};

export default StepNameAddress;
