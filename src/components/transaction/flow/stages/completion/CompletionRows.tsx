// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { MISSING_DEAL_FACTS_TEXT, keysReleasedText, sideConfirmationText } from '@/lib/completionText';
import { useState, type ReactNode } from 'react';
import type { CompletionSide, CompletionStatus } from '@/services/completionStatus';
import type { KeysRole } from '@/lib/completionRoles';

const BUTTON =
  'mt-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors';
const NOTE = 'mt-1 text-xs text-gray-500 dark:text-slate-400';

interface RowProps {
  label: string;
  value: string;
  children?: ReactNode;
}

function Row({ label, value, children }: RowProps): ReactNode {
  return (
    <div className="py-3 border-t border-gray-200 dark:border-slate-700 first:border-t-0">
      <dt className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</dt>
      <dd className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">{value}</dd>
      {children}
    </div>
  );
}

interface SideActionProps {
  side: CompletionSide;
  status: CompletionStatus;
  /** The viewer is a buyer or seller party, not a delegate. */
  viewerIsParty: boolean;
  /** Agreed price or address missing, so nothing honest can be hashed. */
  isMissingDealFacts: boolean;
  busy: boolean;
  /** A warning to read before confirming, e.g. that no completion statement was uploaded. */
  confirmNote: string | null;
  onConfirm: () => void;
}

function sideNote(waitingForBuyer: boolean, isMissingDealFacts: boolean): string {
  if (isMissingDealFacts) return MISSING_DEAL_FACTS_TEXT;
  if (waitingForBuyer) return "Waiting for the buyer's side to confirm funds sent.";
  return 'No conveyancer is acting for you on PropXchain, so you confirm this yourself. It is recorded as client-confirmed.';
}

// What the viewer can do for their own side. Once a verified conveyancer is
// acting, only that conveyancer confirms, so the client just watches. A
// delegate (the estate agent) never confirms money, so sees the rows only.
function SideAction({ side, status, viewerIsParty, isMissingDealFacts, busy, confirmNote, onConfirm }: SideActionProps): ReactNode {
  if (status[side]) return null;
  if (status.conveyancerActing[side]) {
    return viewerIsParty ? <p className={NOTE}>Your conveyancer confirms this on PropXchain.</p> : null;
  }
  if (!viewerIsParty) return null;
  const waitingForBuyer = side === 'seller' && !status.buyer;
  return (
    <div>
      {confirmNote && <p className={NOTE}>{confirmNote}</p>}
      <ConfirmStep
        label={side === 'buyer' ? 'Confirm funds sent' : 'Confirm funds received'}
        records={side === 'buyer' ? 'that completion funds were sent' : 'that completion funds were received'}
        busy={busy}
        disabled={waitingForBuyer || isMissingDealFacts}
        onConfirm={onConfirm}
      />
      <p className={NOTE}>{sideNote(waitingForBuyer, isMissingDealFacts)}</p>
    </div>
  );
}

interface KeysActionProps {
  status: CompletionStatus;
  keysRole: KeysRole;
  busy: boolean;
  onConfirm: () => void;
}

const SECONDARY =
  'mt-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors';

interface ConfirmStepProps {
  /** The button that opens the step, e.g. "Confirm keys released". */
  label: string;
  /** What gets recorded, e.g. "that the keys were released". */
  records: string;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}

// Each of these is recorded on chain and cannot be undone, so it asks once,
// as the conveyancer portal does for the money (card 852523fc).
function ConfirmStep({ label, records, busy, disabled = false, onConfirm }: ConfirmStepProps): ReactNode {
  const [isAsking, setIsAsking] = useState(false);
  if (!isAsking) {
    return (
      <button type="button" onClick={() => setIsAsking(true)} disabled={busy || disabled} className={BUTTON}>
        {label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={`${label}?`}>
      <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200">{label}?</p>
      <p className={NOTE}>This records on PropXchain {records}. It cannot be undone.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setIsAsking(false)} disabled={busy} className={SECONDARY}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={busy || disabled} className={BUTTON}>
          Record it
        </button>
      </div>
    </div>
  );
}

function KeysAction({ status, keysRole, busy, onConfirm }: KeysActionProps): ReactNode {
  if (status.keysReleased) return null;
  if (keysRole === 'seller-with-agent') {
    return <p className={NOTE}>Your estate agent confirms this on PropXchain.</p>;
  }
  if (keysRole !== 'agent' && keysRole !== 'seller') return null;
  return <ConfirmStep label="Confirm keys released" records="that the keys were released" busy={busy} onConfirm={onConfirm} />;
}

export interface CompletionRowsProps {
  status: CompletionStatus;
  viewerSide: CompletionSide;
  viewerIsParty: boolean;
  isMissingDealFacts: boolean;
  keysRole: KeysRole;
  /** Completion has happened, so the keys row applies. */
  completed: boolean;
  busy: boolean;
  /** Read before confirming a side; null for none. */
  confirmNote?: string | null;
  onConfirmSide: () => void;
  onConfirmKeys: () => void;
}

export function CompletionRows({
  status, viewerSide, viewerIsParty, isMissingDealFacts, keysRole, completed, busy, confirmNote = null, onConfirmSide, onConfirmKeys,
}: CompletionRowsProps): ReactNode {
  const action = (side: CompletionSide): ReactNode =>
    side === viewerSide && !completed ? (
      <SideAction
        side={side}
        status={status}
        viewerIsParty={viewerIsParty}
        isMissingDealFacts={isMissingDealFacts}
        busy={busy}
        confirmNote={confirmNote}
        onConfirm={onConfirmSide}
      />
    ) : null;
  return (
    <dl className="flex flex-col">
      <Row label="Buyer's side: completion funds sent" value={sideConfirmationText('buyer', status.buyer)}>
        {action('buyer')}
      </Row>
      <Row label="Seller's side: completion funds received" value={sideConfirmationText('seller', status.seller)}>
        {action('seller')}
      </Row>
      {completed && (
        <Row label="Keys released" value={keysReleasedText(status.keysReleased)}>
          <KeysAction status={status} keysRole={keysRole} busy={busy} onConfirm={onConfirmKeys} />
        </Row>
      )}
    </dl>
  );
}
