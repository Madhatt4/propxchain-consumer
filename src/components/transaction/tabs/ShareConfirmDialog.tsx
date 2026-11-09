// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * ShareConfirmDialog — the last check before a personal document is shared.
 * Names the roles that will gain access (never people), because once a
 * party has downloaded a copy, revoking cannot take it back.
 */
import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import { joinRoles } from './visibilityPresets';

interface ShareConfirmDialogProps {
  docTitle: string;
  roles: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShareConfirmDialog({ docTitle, roles, onConfirm, onCancel }: ShareConfirmDialogProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel, not Share: the safe default for a personal-data decision.
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="share-confirm-title" className="text-base font-semibold text-foreground">
              Share {docTitle}?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This is personal data. <strong className="text-foreground">{joinRoles(roles)}</strong>{' '}
              will be able to open and download it. You can stop sharing later, but not recall a copy
              already downloaded.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
