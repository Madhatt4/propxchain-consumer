// TA10 Fittings & Contents — modernised to match the TA6 form language:
// friendly header + progress, plain-English help card, rooms open by default,
// teal pill toggles. The exported PDF keeps the formal layout for the record.

import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { Principal } from '@propxchain/core-client';
import {
  TA10FittingsAndContents,
  emptyTA10Form,
  DEFAULT_ROOMS,
  DEFAULT_OUTDOOR_ITEMS,
  calculateTA10Completion,
  getItemCounts,
} from '../../types/ta10.types';
import { logger } from '@/utils/logger';
import { getStorePrincipalId } from '@/stores/authStore';
import { FormExportButton } from './FormExportButton';
import { RoomCard } from './ta10/RoomCard';

interface TA10FormProps {
  transactionId: string;
  initialData?: TA10FittingsAndContents | null;
  onSave: (data: TA10FittingsAndContents) => Promise<void>;
  readOnly?: boolean;
  /** Property address shown in the exported PDF header. */
  propertyAddress?: string;
}

function getCallerPrincipal(): Principal {
  const pid = getStorePrincipalId() || '';
  try { return pid ? Principal.fromText(pid) : Principal.anonymous(); }
  catch { return Principal.anonymous(); }
}

function defaultCountFor(roomName: string): number {
  return DEFAULT_ROOMS.find((r) => r.roomName === roomName)?.fittings.length ?? 0;
}

const TA10Form: React.FC<TA10FormProps> = ({ transactionId, initialData, onSave, readOnly = false, propertyAddress }) => {
  const [formData, setFormData] = useState<TA10FittingsAndContents>(() => {
    if (initialData) return initialData;
    return { ...emptyTA10Form, rooms: DEFAULT_ROOMS, outdoorItems: DEFAULT_OUTDOOR_ITEMS };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const completion = calculateTA10Completion(formData);
  const itemCounts = getItemCounts(formData);

  const patch = (partial: Partial<TA10FittingsAndContents>): void => {
    setFormData((prev) => ({
      ...prev,
      ...partial,
      lastModifiedBy: getCallerPrincipal(),
      lastModifiedAt: new Date().toISOString(),
    }));
  };

  const handleSave = async (): Promise<void> => {
    if (readOnly) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
      setLastSaved(new Date());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save form');
      logger.error('TA10 save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = (): void => {
    if (!readOnly) void handleSave();
  };

  useEffect(() => {
    if (initialData) setFormData(initialData);
  }, [initialData]);

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
              What stays and what goes
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              TA10 Fittings and Contents Form
            </p>
          </div>
          <FormExportButton
            payload={{ formType: 'TA10', data: formData }}
            context={{ propertyAddress: propertyAddress ?? '', transactionId }}
            filename={`TA10-${transactionId}`}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-slate-400">
            <span>
              {itemCounts.includedCount} staying · {itemCounts.excludedCount} going
            </span>
            <span>{completion.percentage}% complete</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={completion.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="TA10 completion"
          >
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-300"
              style={{ width: `${completion.percentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-5 py-4 dark:border-sky-900 dark:bg-sky-900/20">
        <div className="flex items-start gap-4">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50"
            aria-hidden="true"
          >
            <Lightbulb className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </span>
          <div className="space-y-1 text-sm leading-relaxed">
            <p className="text-base font-semibold text-sky-950 dark:text-sky-200">
              Mark each item as staying or going
            </p>
            <p className="text-sky-900 dark:text-sky-300">
              Included means it stays with the house; Excluded means you are taking it with you.
              Buyers rely on this list on moving day, and most after-completion disputes are about
              curtains, light fittings and garden pots — so when in doubt, add a note.
            </p>
          </div>
        </div>
      </div>

      {formData.rooms.map((room, roomIndex) => (
        <RoomCard
          key={room.roomName}
          roomName={room.roomName}
          fittings={room.fittings}
          defaultItemCount={defaultCountFor(room.roomName)}
          readOnly={readOnly}
          onBlur={handleBlur}
          onChange={(fittings) =>
            patch({
              rooms: formData.rooms.map((r, i) => (i === roomIndex ? { ...r, fittings } : r)),
            })
          }
        />
      ))}

      <RoomCard
        roomName="Outdoor and garden"
        fittings={formData.outdoorItems}
        defaultItemCount={formData.outdoorItems.length}
        readOnly={readOnly}
        onBlur={handleBlur}
        allowCustomItems={false}
        onChange={(outdoorItems) => patch({ outdoorItems })}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label
          htmlFor="ta10-additional"
          className="mb-1.5 block text-base font-medium text-gray-900 dark:text-slate-100"
        >
          Anything else the buyer should know about?
        </label>
        <textarea
          id="ta10-additional"
          value={formData.additionalItems}
          onChange={(e) => patch({ additionalItems: e.target.value })}
          onBlur={handleBlur}
          disabled={readOnly}
          rows={4}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder="Other fittings, fixtures or items not listed above..."
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saveError && (
          <p className="text-sm text-red-600" role="alert">
            {saveError}
          </p>
        )}
        {lastSaved && !isSaving && !saveError && (
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save form'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TA10Form;
