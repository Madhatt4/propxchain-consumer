// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * WalletNotice — the error / warning line at the top of a deal's Transaction
 * Wallet. Split out so the tab stays under the 300-line ceiling.
 */
import type { VisibilityNotice } from './useDocVisibility';

export function WalletNotice({ notice }: { notice: VisibilityNotice | null }): JSX.Element | null {
  if (!notice) return null;
  return (
    <p
      role="alert"
      className={
        notice.kind === 'error'
          ? 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800'
          : 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'
      }
    >
      {notice.text}
    </p>
  );
}
