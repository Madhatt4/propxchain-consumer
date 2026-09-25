// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Create / edit a single plot within a development site.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, X } from 'lucide-react';

import { plotsService, type Plot } from '@/services/plots.service';
import { plotTypesService, type PlotType } from '@/services/plot-types.service';
import { supabase } from '@/lib/supabase';
import EditTypeModal from '@/components/builder/EditTypeModal';

interface FormState {
  plot_number: string;
  plot_type_id: string;
  sale_price: string;
  description_addendum: string;
  expected_practical_completion: string;
  features_addendum: string[];
}

interface CreatePlotPayload {
  plot_number: string;
  plot_type_id: string | null;
  sale_price_pence: number | null;
  description_addendum: string | null;
  expected_practical_completion: string | null;
  features_addendum: string[];
}

const EMPTY_FORM: FormState = {
  plot_number: '',
  plot_type_id: '',
  sale_price: '',
  description_addendum: '',
  expected_practical_completion: '',
  features_addendum: [],
};

/** Convert pounds string to pence or null. */
function poundsToPence(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

/** Convert pence to pounds display string. */
function penceToPounds(pence: number | null): string {
  if (pence === null) return '';
  return (pence / 100).toFixed(2);
}

function FeatureChipInput({
  features,
  onChange,
}: {
  features: string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const [input, setInput] = useState('');

  const addFeature = (): void => {
    const trimmed = input.trim();
    if (!trimmed || features.includes(trimmed)) return;
    onChange([...features, trimmed]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1 rounded-full bg-[#84A98C]/20 px-3 py-1 font-[DM_Sans] text-xs font-medium text-[#5F8A68] dark:text-[#84A98C]"
          >
            {f}
            <button
              type="button"
              onClick={() => onChange(features.filter((x) => x !== f))}
              className="ml-0.5 rounded-full p-0.5 hover:bg-[#84A98C]/30"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add feature and press Enter"
          className="flex-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        />
        <button
          type="button"
          onClick={addFeature}
          className="rounded-md bg-[#84A98C]/20 px-3 py-2 font-[DM_Sans] text-xs font-medium text-[#5F8A68] hover:bg-[#84A98C]/30 dark:text-[#84A98C]"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function PlotCreatePage(): JSX.Element {
  const { siteId, plotId } = useParams<{ siteId: string; plotId: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(plotId);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [plotTypes, setPlotTypes] = useState<PlotType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditTypeModalOpen, setIsEditTypeModalOpen] = useState(false);
  const originalPlotRef = useRef<Plot | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const types = await plotTypesService.getBySite(siteId);
      setPlotTypes(types);

      if (plotId) {
        const plot = await plotsService.getById(plotId);
        originalPlotRef.current = plot;
        setForm({
          plot_number: plot.plot_number,
          plot_type_id: plot.plot_type_id ?? '',
          sale_price: penceToPounds(plot.sale_price_pence),
          description_addendum: plot.description_addendum ?? '',
          expected_practical_completion: plot.expected_practical_completion ?? '',
          features_addendum: plot.features_addendum ?? [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId, plotId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Build the update/create payload from current form state. */
  const buildPayload = useCallback((): CreatePlotPayload => ({
    plot_number: form.plot_number.trim(),
    plot_type_id: form.plot_type_id || null,
    sale_price_pence: poundsToPence(form.sale_price),
    description_addendum: form.description_addendum.trim() || null,
    expected_practical_completion: form.expected_practical_completion || null,
    features_addendum: form.features_addendum,
  }), [form]);

  const isPublishedEdit =
    isEdit && originalPlotRef.current?.listing_status === 'published';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!siteId || !form.plot_number.trim()) return;

    if (isPublishedEdit) {
      setIsEditTypeModalOpen(true);
      return;
    }

    await savePlot('cosmetic');
  };

  /** Persist the plot, optionally recording a material-edit audit row first. */
  const savePlot = async (editType: 'cosmetic' | 'material'): Promise<void> => {
    if (!siteId) return;
    setIsEditTypeModalOpen(false);
    setIsSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      if (isEdit && plotId) {
        if (editType === 'material') {
          await recordChanges(plotId, payload);
        }
        await plotsService.update(plotId, payload);
      } else {
        await plotsService.create({ site_id: siteId, ...payload });
      }
      navigate(`/builder/sites/${siteId}/plots`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plot.');
    } finally {
      setIsSaving(false);
    }
  };

  /** Detect changed fields and insert a plot_listing_edits audit row. */
  const recordChanges = async (
    id: string,
    payload: CreatePlotPayload,
  ): Promise<void> => {
    const original = originalPlotRef.current;
    if (!original) return;

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) throw new Error('Not authenticated — cannot record edit.');

    const fieldMap: Record<string, { prev: unknown; next: unknown }> = {
      plot_number: { prev: original.plot_number, next: payload.plot_number },
      plot_type_id: { prev: original.plot_type_id, next: payload.plot_type_id },
      sale_price_pence: { prev: original.sale_price_pence, next: payload.sale_price_pence },
      description_addendum: { prev: original.description_addendum, next: payload.description_addendum },
      expected_practical_completion: { prev: original.expected_practical_completion, next: payload.expected_practical_completion },
      features_addendum: { prev: original.features_addendum, next: payload.features_addendum },
    };

    const changedFields: string[] = [];
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const [key, { prev, next }] of Object.entries(fieldMap)) {
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        changedFields.push(key);
        previousValues[key] = prev;
        newValues[key] = next;
      }
    }

    if (changedFields.length === 0) return;

    // TODO: canister audit event before Supabase write
    await plotsService.recordMaterialEdit(
      id,
      userId,
      changedFields,
      previousValues,
      newValues,
    );
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/builder/sites/${siteId}/plots`}
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          {isEdit ? 'Edit plot' : 'New plot'}
        </h1>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 font-[DM_Sans] text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Plot number */}
        <div>
          <label className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
            Plot number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.plot_number}
            onChange={(e) => updateField('plot_number', e.target.value)}
            placeholder="e.g. Plot 1, 14A"
            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[Geist_Mono] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>

        {/* Plot type */}
        <div>
          <label className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
            Plot type
          </label>
          <select
            value={form.plot_type_id}
            onChange={(e) => updateField('plot_type_id', e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          >
            <option value="">None (no template)</option>
            {plotTypes.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
                {pt.base_price_pence !== null
                  ? ` — \u00A3${(pt.base_price_pence / 100).toLocaleString('en-GB')}`
                  : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 font-[DM_Sans] text-xs text-[var(--text-secondary)]">
            Inherit defaults from a plot type template.
          </p>
        </div>

        {/* Sale price */}
        <div>
          <label className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
            Sale price
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-[Geist_Mono] text-sm text-[var(--text-secondary)]">
              &pound;
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={form.sale_price}
              onChange={(e) => updateField('sale_price', e.target.value)}
              placeholder="Leave blank to inherit from type"
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] py-2 pl-7 pr-3 font-[Geist_Mono] text-sm text-[var(--text-main)] placeholder:font-[DM_Sans] placeholder:text-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
            />
          </div>
        </div>

        {/* Description addendum */}
        <div>
          <label className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
            Description addendum
          </label>
          <textarea
            rows={3}
            value={form.description_addendum}
            onChange={(e) => updateField('description_addendum', e.target.value)}
            placeholder="Plot-specific notes or description additions"
            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>

        {/* Expected practical completion */}
        <div>
          <label className="block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
            Expected practical completion
          </label>
          <input
            type="date"
            value={form.expected_practical_completion}
            onChange={(e) => updateField('expected_practical_completion', e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>

        {/* Features addendum */}
        <div>
          <label className="mb-2 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
            Features addendum
          </label>
          <FeatureChipInput
            features={form.features_addendum}
            onChange={(next) => updateField('features_addendum', next)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={isSaving || !form.plot_number.trim()}
            className="inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : isEdit ? (
              'Update plot'
            ) : (
              'Create plot'
            )}
          </button>
          <Link
            to={`/builder/sites/${siteId}/plots`}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
          >
            Cancel
          </Link>
        </div>
      </form>

      <EditTypeModal
        isOpen={isEditTypeModalOpen}
        onClose={() => setIsEditTypeModalOpen(false)}
        onSelect={savePlot}
      />
    </div>
  );
}
