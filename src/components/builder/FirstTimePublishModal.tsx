// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Confirmation modal shown on a developer's very first publish action.
 * Checks localStorage for `propxchain_has_published` flag.
 */

import { useCallback } from 'react';

const STORAGE_KEY = 'propxchain_has_published';

interface FirstTimePublishModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Check whether the current user has ever published a plot. */
export function hasPublishedBefore(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/** Mark that the current user has published at least once. */
export function markAsPublished(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}

export default function FirstTimePublishModal({
  isOpen,
  onConfirm,
  onCancel,
}: FirstTimePublishModalProps): JSX.Element | null {
  const handleConfirm = useCallback((): void => {
    markAsPublished();
    onConfirm();
  }, [onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        role="presentation"
      />

      {/* Card */}
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-xl">
        <h2 className="font-[Fraunces] text-xl font-semibold text-[var(--text-main)]">
          This is a public record.
        </h2>

        <p className="mt-3 font-[DM_Sans] text-sm leading-relaxed text-[var(--text-secondary)]">
          Once published, the listing slug is permanent and any material changes
          will be recorded on-chain. Anyone you share the URL with can verify the
          audit trail.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
          >
            Publish to chain
          </button>
        </div>
      </div>
    </div>
  );
}
