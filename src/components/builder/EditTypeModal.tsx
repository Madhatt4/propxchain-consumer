// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Modal asking the developer whether a published-plot edit
 * is cosmetic (typo, image swap) or material (price, features, dates).
 */

type EditType = 'cosmetic' | 'material';

interface EditTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: EditType) => void;
}

export default function EditTypeModal({
  isOpen,
  onClose,
  onSelect,
}: EditTypeModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      {/* Card */}
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-xl">
        <h2 className="font-[Fraunces] text-xl font-semibold text-[var(--text-main)]">
          What kind of edit is this?
        </h2>

        <p className="mt-3 font-[DM_Sans] text-sm leading-relaxed text-[var(--text-secondary)]">
          This plot is already published. Choose whether your changes are
          cosmetic or material so we can keep the audit trail accurate.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {/* Cosmetic */}
          <button
            type="button"
            onClick={() => onSelect('cosmetic')}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-left transition-colors hover:border-[#84A98C] hover:bg-[var(--bg-section)]"
          >
            <span className="block font-[DM_Sans] text-sm font-semibold text-[var(--text-main)]">
              Cosmetic edit
            </span>
            <span className="mt-0.5 block font-[DM_Sans] text-xs text-[var(--text-secondary)]">
              Fix a typo, swap a photo, improve the description. No on-chain record.
            </span>
          </button>

          {/* Material */}
          <button
            type="button"
            onClick={() => onSelect('material')}
            className="w-full rounded-lg border-2 border-[#0D9488] bg-[#CCFBF1] px-4 py-3 text-left transition-colors hover:bg-[#99F6E4] dark:border-[#14B8A6] dark:bg-[#042F2E] dark:hover:bg-[#0D3D38]"
          >
            <span className="block font-[DM_Sans] text-sm font-semibold text-[var(--text-main)]">
              Material edit
            </span>
            <span className="mt-0.5 block font-[DM_Sans] text-xs text-[var(--text-secondary)]">
              Change the price, features, or completion date. This will be recorded on-chain.
            </span>
          </button>

          <p className="mt-1 text-center font-[DM_Sans] text-xs text-[var(--text-muted)]">
            If in doubt, mark it material.
          </p>
        </div>

        {/* Cancel */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
