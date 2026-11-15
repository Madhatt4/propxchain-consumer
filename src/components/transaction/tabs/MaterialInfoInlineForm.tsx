// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Fill the "About your property" gaps without leaving the Sales pack. Shows
 * only the missing fields (plus the lease trio once the seller picks
 * leasehold), saves through Stage 1's path, then re-runs readiness so the
 * tick comes from the saved listing, never from this form.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Tenure } from '@/types/listing.types';
import type { MaterialInfoGap } from '@/services/materialInfo';
import { saveMaterialInfoPatch, type MaterialInfoPatch } from '@/services/materialInfoSave';
import { COUNCIL_TAX_BANDS, PROPERTY_TYPES } from '../flow/stages/listingOptions';
import { listingChainFailedToast } from '../flow/stages/listingChainToast';

type InlineField = Exclude<MaterialInfoGap, 'address' | 'postcode' | 'price'>;
type Draft = Partial<Record<InlineField, string>>;

const LEASE_FIELDS: InlineField[] = ['leaseYearsRemaining', 'groundRentPerYear', 'serviceChargePerYear'];
const ORDER: InlineField[] = ['councilTaxBand', 'tenure', 'propertyType', ...LEASE_FIELDS];

const LABEL: Record<InlineField, string> = {
  councilTaxBand: 'Council tax band',
  tenure: 'Tenure',
  propertyType: 'Property type',
  leaseYearsRemaining: 'Years left on the lease',
  groundRentPerYear: 'Ground rent (£ a year)',
  serviceChargePerYear: 'Service charge (£ a year)',
};

const TENURES: Array<{ value: Exclude<Tenure, 'unknown'>; label: string }> = [
  { value: 'freehold', label: 'Freehold' },
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'shareOfFreehold', label: 'Share of freehold' },
];

const CONTROL = 'rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800';

function isValid(field: InlineField, raw: string | undefined): boolean {
  const v = (raw ?? '').trim();
  if (!v) return false;
  if (!LEASE_FIELDS.includes(field)) return true;
  const n = Number(v);
  return field === 'leaseYearsRemaining' ? n > 0 : Number.isFinite(n) && n >= 0;
}

function toPatch(fields: InlineField[], draft: Draft): MaterialInfoPatch {
  const patch: MaterialInfoPatch = {};
  for (const f of fields) {
    const v = (draft[f] ?? '').trim();
    if (f === 'tenure') patch.tenure = v as Tenure;
    else if (f === 'propertyType' || f === 'councilTaxBand') patch[f] = v;
    else patch[f] = Number(v);
  }
  return patch;
}

function options(field: InlineField): Array<{ value: string; label: string }> | null {
  if (field === 'councilTaxBand') return COUNCIL_TAX_BANDS.map((b) => ({ value: b, label: b }));
  if (field === 'propertyType') return PROPERTY_TYPES.map((t) => ({ value: t, label: t }));
  if (field === 'tenure') return TENURES;
  return null;
}

function InlineInput({ field, value, onChange }: { field: InlineField; value: string; onChange: (v: string) => void }): ReactNode {
  const opts = options(field);
  return (
    <label className="flex items-center gap-1.5">
      <span>{LABEL[field]}</span>
      {opts ? (
        <select className={CONTROL} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type="number" min={0} className={`${CONTROL} w-24`} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function MaterialInfoInlineForm({ transactionId, missing }: { transactionId: string; missing: MaterialInfoGap[] }): ReactNode {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => {
    const wanted = new Set<MaterialInfoGap>(missing);
    if (draft.tenure === 'leasehold') LEASE_FIELDS.forEach((f) => wanted.add(f));
    return ORDER.filter((f) => wanted.has(f));
  }, [missing, draft.tenure]);

  const canSave = fields.length > 0 && fields.every((f) => isValid(f, draft[f])) && !saving;

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await saveMaterialInfoPatch(transactionId, toPatch(fields, draft));
      if (result.saved && !result.chainOk) toast(listingChainFailedToast(result.error));
      await queryClient.invalidateQueries({ queryKey: ['salesPack', 'readiness', transactionId] });
    } finally {
      setSaving(false);
    }
  };

  if (fields.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      {fields.map((f) => (
        <InlineInput key={f} field={f} value={draft[f] ?? ''} onChange={(v) => setDraft((d) => ({ ...d, [f]: v }))} />
      ))}
      <button
        type="button"
        onClick={() => { void handleSave(); }}
        disabled={!canSave}
        className="rounded-md bg-teal-600 px-3 py-1 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400">Everything else is already filled in from step 1 of your listing.</span>
    </div>
  );
}
