// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * First-visit presentation of a stage explainer. The wrapper owns only when
 * it interrupts — the content is whatever the stage passes as children, and
 * is identical to what ExplainerCard shows afterwards, so dismissing the
 * modal discards nothing.
 */

import React, { useState, type ReactNode } from 'react';

import { hasSeenExplainer, markExplainerSeen } from './explainerSeen';

export interface ExplainerModalProps {
  /** Namespaces the seen-flag so each stage's explainer dismisses separately. */
  storageKey: string;
  transactionId: string;
  title: string;
  /** Label for the dismiss button, so each stage can name its own next step. */
  dismissLabel?: string;
  children: ReactNode;
}

export default function ExplainerModal({
  storageKey,
  transactionId,
  title,
  dismissLabel = 'Got it',
  children,
}: ExplainerModalProps): React.ReactElement | null {
  const [open, setOpen] = useState(() => !hasSeenExplainer(storageKey, transactionId));

  if (!open) return null;

  function dismiss(): void {
    markExplainerSeen(storageKey, transactionId);
    setOpen(false);
  }

  const titleId = `explainer-title-${storageKey}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#0D9488]/40 bg-white p-5 shadow-xl dark:bg-[#0F1729]"
      >
        <h3
          id={titleId}
          className="font-fraunces text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {title}
        </h3>
        <div className="mt-3">{children}</div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 rounded-lg bg-[#0D9488] px-4 py-2 font-dm-sans text-sm font-medium text-white"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
