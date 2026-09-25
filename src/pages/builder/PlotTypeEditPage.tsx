// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Create / edit form for a single plot type.
 * Route: /builder/sites/:siteId/plot-types/new (create)
 *        /builder/sites/:siteId/plot-types/:plotTypeId/edit (edit)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';

import {
  plotTypesService,
  type PlotType,
  type ImageRef,
  type CreatePlotTypeInput,
} from '@/services/plot-types.service';

import FeatureChips from './components/FeatureChips';
import ImageUploadSection from './components/ImageUploadSection';

const EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

interface FormState {
  name: string;
  description: string;
  bedrooms: string;
  bathrooms: string;
  internalAreaSqft: string;
  basePricePounds: string;
  epcRating: string;
  features: string[];
  floorPlanRefs: ImageRef[];
  exteriorRefs: ImageRef[];
  interiorRefs: ImageRef[];
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  bedrooms: '',
  bathrooms: '',
  internalAreaSqft: '',
  basePricePounds: '',
  epcRating: '',
  features: [],
  floorPlanRefs: [],
  exteriorRefs: [],
  interiorRefs: [],
};

function mapPlotTypeToForm(pt: PlotType): FormState {
  return {
    name: pt.name,
    description: pt.description ?? '',
    bedrooms: pt.bedrooms?.toString() ?? '',
    bathrooms: pt.bathrooms?.toString() ?? '',
    internalAreaSqft: pt.internal_area_sqft?.toString() ?? '',
    basePricePounds: pt.base_price_pence ? (pt.base_price_pence / 100).toString() : '',
    epcRating: pt.epc_rating ?? '',
    features: pt.features ?? [],
    floorPlanRefs: pt.floor_plan_image_refs ?? [],
    exteriorRefs: pt.exterior_image_refs ?? [],
    interiorRefs: pt.interior_image_refs ?? [],
  };
}

function buildInput(siteId: string, form: FormState): CreatePlotTypeInput {
  return {
    site_id: siteId,
    name: form.name.trim(),
    description: form.description.trim() || null,
    bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : null,
    bathrooms: form.bathrooms ? parseInt(form.bathrooms, 10) : null,
    internal_area_sqft: form.internalAreaSqft ? parseInt(form.internalAreaSqft, 10) : null,
    base_price_pence: form.basePricePounds ? Math.round(parseFloat(form.basePricePounds) * 100) : null,
    epc_rating: form.epcRating || null,
    features: form.features,
    floor_plan_image_refs: form.floorPlanRefs,
    exterior_image_refs: form.exteriorRefs,
    interior_image_refs: form.interiorRefs,
  };
}

export default function PlotTypeEditPage(): JSX.Element {
  const { siteId, plotTypeId } = useParams<{ siteId: string; plotTypeId: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(plotTypeId);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listUrl = `/builder/sites/${siteId}/plot-types`;

  const fetchExisting = useCallback(async (): Promise<void> => {
    if (!plotTypeId) return;
    setIsLoading(true);
    try {
      const pt = await plotTypesService.getById(plotTypeId);
      setForm(mapPlotTypeToForm(pt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plot type.');
    } finally {
      setIsLoading(false);
    }
  }, [plotTypeId]);

  useEffect(() => {
    if (isEdit) fetchExisting();
  }, [isEdit, fetchExisting]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (): Promise<void> => {
    if (!siteId || !form.name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const input = buildInput(siteId, form);
      if (isEdit && plotTypeId) {
        const { site_id: _siteId, ...updateInput } = input;
        await plotTypesService.update(plotTypeId, updateInput);
      } else {
        await plotTypesService.create(input);
      }
      navigate(listUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plot type.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  const inputClasses =
    'w-full min-h-12 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:focus:border-[#0D9488]';
  const labelClasses = 'block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] mb-1.5';

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={listUrl}
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          {isEdit ? 'Edit plot type' : 'New plot type'}
        </h1>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 dark:bg-red-900/20">
          <p className="font-[DM_Sans] text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="mt-8 space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="pt-name" className={labelClasses}>Name *</label>
          <input id="pt-name" type="text" required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="e.g. The Ashbourne" className={inputClasses} />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="pt-desc" className={labelClasses}>Description</label>
          <textarea id="pt-desc" rows={3} value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Brief description of this house type" className={inputClasses + ' min-h-[80px]'} />
        </div>

        {/* Number fields row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="pt-beds" className={labelClasses}>Bedrooms</label>
            <input id="pt-beds" type="number" min={0} value={form.bedrooms} onChange={(e) => updateField('bedrooms', e.target.value)} placeholder="3" className={inputClasses} />
          </div>
          <div>
            <label htmlFor="pt-baths" className={labelClasses}>Bathrooms</label>
            <input id="pt-baths" type="number" min={0} value={form.bathrooms} onChange={(e) => updateField('bathrooms', e.target.value)} placeholder="2" className={inputClasses} />
          </div>
          <div>
            <label htmlFor="pt-area" className={labelClasses}>Area (sq ft)</label>
            <input id="pt-area" type="number" min={0} value={form.internalAreaSqft} onChange={(e) => updateField('internalAreaSqft', e.target.value)} placeholder="1200" className={inputClasses} />
          </div>
        </div>

        {/* Price + EPC row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pt-price" className={labelClasses}>Base price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">&pound;</span>
              <input id="pt-price" type="number" min={0} step={1} value={form.basePricePounds} onChange={(e) => updateField('basePricePounds', e.target.value)} placeholder="295000" className={inputClasses + ' pl-7'} />
            </div>
          </div>
          <div>
            <label htmlFor="pt-epc" className={labelClasses}>EPC rating</label>
            <select id="pt-epc" value={form.epcRating} onChange={(e) => updateField('epcRating', e.target.value)} className={inputClasses}>
              <option value="">-- Select --</option>
              {EPC_RATINGS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Features */}
        <div>
          <label className={labelClasses}>Features</label>
          <FeatureChips features={form.features} onChange={(f) => updateField('features', f)} />
        </div>

        {/* Images hint */}
        <div className="rounded-md bg-[#84A98C]/10 p-4 dark:bg-[#84A98C]/5">
          <p className="font-[DM_Sans] text-sm text-[#5F8A68] dark:text-[#84A98C]">
            Plot types are templates &mdash; most developers build 3&ndash;5 standard house types per site, so you&apos;ll only upload the photos once.
          </p>
        </div>

        {/* Image uploads */}
        <ImageUploadSection label="Floor plans" refs={form.floorPlanRefs} onChange={(r) => updateField('floorPlanRefs', r)} />
        <ImageUploadSection label="Exterior photos" refs={form.exteriorRefs} onChange={(r) => updateField('exteriorRefs', r)} />
        <ImageUploadSection label="Interior photos" refs={form.interiorRefs} onChange={(r) => updateField('interiorRefs', r)} />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="button"
            disabled={isSaving || !form.name.trim()}
            onClick={handleSave}
            className="inline-flex min-h-12 items-center rounded-md bg-[#0D9488] px-6 py-3 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Create plot type'}
          </button>
          <Link
            to={listUrl}
            className="inline-flex min-h-12 items-center rounded-md border border-[var(--border-color)] px-6 py-3 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-section)]"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
