// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Confirmation modal for releasing a buyer's reservation (buyer ghosted).
 */

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

import { reservationService } from '@/services/reservation.service';

interface ReleaseReservationModalProps {
  isOpen: boolean;
  plotId: string;
  plotNumber: string;
  onClose: () => void;
  onReleased: () => void;
}

export default function ReleaseReservationModal({
  isOpen,
  plotId,
  plotNumber,
  onClose,
  onReleased,
}: ReleaseReservationModalProps): JSX.Element | null {
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRelease = useCallback(async (): Promise<void> => {
    setIsReleasing(true);
    setError(null);
    try {
      await reservationService.releaseReservation(plotId);
      onReleased();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release reservation.');
    } finally {
      setIsReleasing(false);
    }
  }, [plotId, onReleased]);

  const handleClose = useCallback((): void => {
    if (isReleasing) return;
    setError(null);
    onClose();
  }, [isReleasing, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        role="presentation"
      />

      {/* Card */}
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-xl">
        <h2 className="font-[Fraunces] text-xl font-semibold text-[var(--text-main)]">
          Release this reservation?
        </h2>

        <p className="mt-3 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          This will cancel the pending reservation and make this plot available
          again. The on-chain audit trail will record this release.
        </p>

        <div className="mt-4 rounded-md bg-[var(--bg-section)] px-4 py-3">
          <p className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">
            Plot
          </p>
          <p className="font-[DM_Sans] text-lg font-semibold text-[var(--text-main)]">
            {plotNumber}
          </p>
        </div>

        {error && (
          <p className="mt-3 font-[DM_Sans] text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isReleasing}
            className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRelease}
            disabled={isReleasing}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isReleasing && <Loader2 className="h-4 w-4 animate-spin" />}
            Release reservation
          </button>
        </div>
      </div>
    </div>
  );
}
