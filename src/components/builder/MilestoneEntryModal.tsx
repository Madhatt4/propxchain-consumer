// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Modal form for creating or editing a build milestone.
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

import type {
  BuildMilestone,
  MilestoneType,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from '@/services/milestones.service';

interface PlotOption {
  id: string;
  plot_number: string;
}

interface MilestoneEntryModalProps {
  siteId: string;
  plots: PlotOption[];
  milestone?: BuildMilestone | null;
  onSave: (input: CreateMilestoneInput | UpdateMilestoneInput) => Promise<void>;
  onClose: () => void;
}

const CATEGORY_OPTIONS: { value: MilestoneType; label: string }[] = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'roof_on', label: 'Structure / Roof' },
  { value: 'practical_completion', label: 'Practical completion' },
  { value: 'nhbc_signoff', label: 'NHBC sign-off' },
  { value: 'custom', label: 'Other' },
];

const INPUT_CLS =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-main)] ' +
  'focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]';

export default function MilestoneEntryModal({
  siteId,
  plots,
  milestone,
  onSave,
  onClose,
}: MilestoneEntryModalProps): JSX.Element {
  const isEdit = Boolean(milestone);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [scope, setScope] = useState<'site' | 'plot'>('site');
  const [plotId, setPlotId] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState('');
  const [category, setCategory] = useState<MilestoneType>('foundation');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (milestone) {
      setName(milestone.custom_label ?? labelForType(milestone.milestone_type));
      setNotes(milestone.notes ?? '');
      setScope(milestone.plot_id ? 'plot' : 'site');
      setPlotId(milestone.plot_id ?? '');
      setExpectedDate(milestone.expected_date ?? '');
      setCategory(milestone.milestone_type ?? 'custom');
    }
  }, [milestone]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!expectedDate) {
      setFormError('Target date is required.');
      return;
    }
    if (scope === 'plot' && !plotId) {
      setFormError('Please select a plot.');
      return;
    }

    setIsSaving(true);
    try {
      const customLabel = category === 'custom' ? name.trim() : name.trim();

      if (isEdit) {
        const update: UpdateMilestoneInput = {
          milestone_type: category,
          custom_label: customLabel,
          expected_date: expectedDate,
          notes: notes.trim() || null,
          plot_id: scope === 'plot' ? plotId : null,
        };
        await onSave(update);
      } else {
        const create: CreateMilestoneInput = {
          site_id: siteId,
          plot_id: scope === 'plot' ? plotId : null,
          milestone_type: category,
          custom_label: customLabel,
          expected_date: expectedDate,
          notes: notes.trim() || null,
        };
        await onSave(create);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-[Fraunces] text-lg font-semibold text-[var(--text-main)]">
            {isEdit ? 'Edit milestone' : 'Add milestone'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Foundation poured"
              className={INPUT_CLS}
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MilestoneType)}
              className={INPUT_CLS}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <fieldset>
            <legend className="mb-1 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
              Scope
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="scope"
                  value="site"
                  checked={scope === 'site'}
                  onChange={() => setScope('site')}
                  className="accent-[#0D9488]"
                />
                Site-wide
              </label>
              <label className="flex items-center gap-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="scope"
                  value="plot"
                  checked={scope === 'plot'}
                  onChange={() => setScope('plot')}
                  className="accent-[#0D9488]"
                />
                Specific plot
              </label>
            </div>
          </fieldset>

          {/* Plot dropdown (conditional) */}
          {scope === 'plot' && (
            <div>
              <label className="mb-1 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
                Plot
              </label>
              <select
                value={plotId}
                onChange={(e) => setPlotId(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">Select a plot...</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    Plot {p.plot_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target date */}
          <div>
            <label className="mb-1 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
              Target date *
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={INPUT_CLS}
              placeholder="Optional description or notes"
            />
          </div>

          {/* Error */}
          {formError && (
            <p className="font-[DM_Sans] text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-color)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEdit ? 'Update' : 'Add milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Map milestone_type enum to a human-readable label. */
function labelForType(type: MilestoneType | null): string {
  switch (type) {
    case 'foundation':
      return 'Foundation';
    case 'roof_on':
      return 'Structure / Roof';
    case 'practical_completion':
      return 'Practical completion';
    case 'nhbc_signoff':
      return 'NHBC sign-off';
    case 'custom':
      return '';
    default:
      return '';
  }
}
