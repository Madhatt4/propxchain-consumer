// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * AddFromWalletPicker — the explicit "send" step (wallet spec decision 1):
 * lists PropXchain Wallet files not yet in this deal, grouped by slot, each
 * with a Send button. Nothing is shared by sending — parties are switched on
 * afterwards.
 */
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { VAULT_SLOTS, type VaultDocument } from '@/types/vault.types';
import { slotDisplayLabel } from '@/utils/vaultSlotLabel';

interface AddFromWalletPickerProps {
  principal: string;
  /** All wallet docs minus those already sent to this deal. */
  candidates: VaultDocument[];
  busyIds: Set<string>;
  onSend: (doc: VaultDocument) => void;
  onClose: () => void;
}

export function AddFromWalletPicker({
  principal,
  candidates,
  busyIds,
  onSend,
  onClose,
}: AddFromWalletPickerProps): JSX.Element {
  const groups = VAULT_SLOTS.map((slot) => ({
    slot,
    docs: candidates.filter((d) => d.slotId === slot.id),
  })).filter((g) => g.docs.length > 0);

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Add from your PropXchain Wallet</p>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <Wallet className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Everything in your wallet is already in this deal, or your wallet is empty.{' '}
            <Link to="/dashboard/my-documents" className="font-medium text-teal-700 hover:text-teal-900">
              Open your PropXchain Wallet
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ slot, docs }) => (
            <div key={slot.id}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {slotDisplayLabel(slot.id, principal)}
              </p>
              <ul className="space-y-1">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <span className="truncate text-xs text-foreground">
                      {doc.label ?? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                    </span>
                    <button
                      type="button"
                      disabled={busyIds.has(doc.id)}
                      onClick={() => onSend(doc)}
                      className="shrink-0 rounded bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {busyIds.has(doc.id) ? 'Sending…' : 'Send to this deal'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Empty state for a deal with nothing sent yet. */
export function EmptyDealWallet({ walletIsEmpty }: { walletIsEmpty: boolean }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
      <Wallet className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">Nothing in this deal’s wallet yet</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Use <b>Add from wallet</b> to send documents here, then switch on the parties who may see each one.
        {walletIsEmpty && (
          <>
            {' '}Your{' '}
            <Link to="/dashboard/my-documents" className="font-medium text-teal-700 hover:text-teal-900">
              PropXchain Wallet
            </Link>{' '}
            is empty — upload there first.
          </>
        )}
      </p>
    </div>
  );
}
