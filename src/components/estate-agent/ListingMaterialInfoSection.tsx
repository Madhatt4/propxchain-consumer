// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Material information section: the read-only merged view, the agent's
 * editable overrides, and a save action.
 */

import { MaterialInfoPanel } from '@/components/public/MaterialInfoPanel';
import { MaterialInfoEditor } from '@/components/estate-agent/MaterialInfoEditor';
import type { MaterialInfo, MaterialInfoOverrides } from '@/types/materialInfo.types';

export interface ListingMaterialInfoSectionProps {
  info: MaterialInfo;
  tenure: string | null;
  overrides: MaterialInfoOverrides;
  onOverridesChange: (next: MaterialInfoOverrides) => void;
  onSave: () => void;
  isSaving: boolean;
}

/** Preview + editable overrides for a listing's Material Information, with
 *  a save button that persists the currently merged `info`. */
export function ListingMaterialInfoSection({
  info,
  tenure,
  overrides,
  onOverridesChange,
  onSave,
  isSaving,
}: ListingMaterialInfoSectionProps): JSX.Element {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 font-[Fraunces] text-lg font-semibold text-gray-900 dark:text-gray-50">
        Material information
      </h2>
      <MaterialInfoPanel info={info} tenure={tenure} />
      <div className="mt-6">
        <MaterialInfoEditor value={overrides} onChange={onOverridesChange} />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Save material information
        </button>
      </div>
    </section>
  );
}

export default ListingMaterialInfoSection;
