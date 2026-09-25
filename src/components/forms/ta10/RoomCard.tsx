// One room's fittings inventory. Open by default (Marc: fields open, not
// hidden behind clicks) with a collapse toggle for sellers who want to skim.

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

import { FittingRow } from './FittingRow';
import type { TA10FittingItem } from '../../../types/ta10.types';

export interface RoomCardProps {
  roomName: string;
  fittings: TA10FittingItem[];
  /** Item count in this room's default template — anything beyond is custom. */
  defaultItemCount: number;
  readOnly: boolean;
  onChange: (fittings: TA10FittingItem[]) => void;
  onBlur?: () => void;
  /** Hide the add-custom-item affordance (outdoor list keeps its fixed set). */
  allowCustomItems?: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  roomName,
  fittings,
  defaultItemCount,
  readOnly,
  onChange,
  onBlur,
  allowCustomItems = true,
}) => {
  const [open, setOpen] = useState(true);
  const includedCount = fittings.filter((f) => f.included).length;

  const updateItem = (index: number, updated: TA10FittingItem): void => {
    onChange(fittings.map((f, i) => (i === index ? updated : f)));
  };

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      aria-label={roomName}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100">
            {roomName}
          </span>
          <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
            {includedCount} of {fittings.length} staying
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="space-y-3 px-5 pb-5">
          {fittings.map((fitting, index) => (
            <FittingRow
              key={index}
              fitting={fitting}
              isCustom={index >= defaultItemCount}
              readOnly={readOnly}
              onChange={(updated) => updateItem(index, updated)}
              onRemove={() => onChange(fittings.filter((_, i) => i !== index))}
              onBlur={onBlur}
            />
          ))}
          {!readOnly && allowCustomItems && (
            <button
              type="button"
              onClick={() => onChange([...fittings, { item: '', included: false, notes: null }])}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-3 text-sm font-medium text-gray-500 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-teal-600 dark:hover:bg-teal-900/20"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add another item in this room
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default RoomCard;
