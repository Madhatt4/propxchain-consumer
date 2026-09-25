// One fittings item: name, Included/Excluded pill toggle, notes. Custom items
// (anything beyond the room's default template) get an editable name + remove.

import React from 'react';
import { Check, Trash2, X } from 'lucide-react';

import type { TA10FittingItem } from '../../../types/ta10.types';

export interface FittingRowProps {
  fitting: TA10FittingItem;
  /** Custom (user-added) items get an editable name and a remove button. */
  isCustom: boolean;
  readOnly: boolean;
  onChange: (fitting: TA10FittingItem) => void;
  onRemove?: () => void;
  onBlur?: () => void;
}

const PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ' +
  'duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ' +
  'focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed';

export const FittingRow: React.FC<FittingRowProps> = ({
  fitting,
  isCustom,
  readOnly,
  onChange,
  onRemove,
  onBlur,
}) => (
  <div className="space-y-2 rounded-xl bg-gray-50 p-4 dark:bg-slate-800/60">
    <div className="flex flex-wrap items-center gap-3">
      {isCustom && !readOnly ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="text"
            value={fitting.item}
            onChange={(e) => onChange({ ...fitting, item: e.target.value })}
            onBlur={onBlur}
            placeholder="Item name"
            className="w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${fitting.item || 'custom item'}`}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <span className="min-w-0 flex-1 text-base font-medium text-gray-900 dark:text-slate-100">
          {fitting.item}
        </span>
      )}

      <div role="group" aria-label={`${fitting.item} included or excluded`} className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...fitting, included: true })}
          disabled={readOnly}
          aria-pressed={fitting.included}
          className={`${PILL_BASE} ${
            fitting.included
              ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {fitting.included && <Check className="h-4 w-4" aria-hidden="true" />}
          Included
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...fitting, included: false })}
          disabled={readOnly}
          aria-pressed={!fitting.included}
          className={`${PILL_BASE} ${
            !fitting.included
              ? 'bg-rose-100 text-rose-700 shadow-sm hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {!fitting.included && <X className="h-4 w-4" aria-hidden="true" />}
          Excluded
        </button>
      </div>
    </div>

    <input
      type="text"
      value={fitting.notes ?? ''}
      onChange={(e) => onChange({ ...fitting, notes: e.target.value || null })}
      onBlur={onBlur}
      disabled={readOnly}
      placeholder="Notes — condition, model, or anything the buyer should know"
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
    />
  </div>
);

export default FittingRow;
