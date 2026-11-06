// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { ReactNode } from 'react';
import type { CompletionSide, CompletionStatus } from '@/services/completionStatus';
import type { KeysRole } from '@/lib/completionRoles';
import { keysReleasedText, sideConfirmationText } from './completionText';

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
  busy: boolean;
  onConfirm: () => void;
}

// What the viewer can do for their own side. Once a verified conveyancer is
// acting, only that conveyancer confirms, so the client just watches.
function SideAction({ side, status, busy, onConfirm }: SideActionProps): ReactNode {
  if (status[side]) return null;
  if (status.conveyancerActing[side]) {
    return <p className={NOTE}>Your conveyancer confirms this on PropXchain.</p>;
  }
  const waitingForBuyer = side === 'seller' && !status.buyer;
  return (
    <div>
      <button type="button" onClick={onConfirm} disabled={busy || waitingForBuyer} className={BUTTON}>
        {side === 'buyer' ? 'Confirm funds sent' : 'Confirm funds received'}
      </button>
      <p className={NOTE}>
        {waitingForBuyer
          ? "Waiting for the buyer's side to confirm funds sent."
          : 'No conveyancer is acting for you on PropXchain, so you confirm this yourself. It is recorded as client-confirmed.'}
      </p>
    </div>
  );
}

interface KeysActionProps {
  status: CompletionStatus;
  keysRole: KeysRole;
  busy: boolean;
  onConfirm: () => void;
}

function KeysAction({ status, keysRole, busy, onConfirm }: KeysActionProps): ReactNode {
  if (status.keysReleased) return null;
  if (keysRole === 'seller-with-agent') {
    return <p className={NOTE}>Your estate agent confirms this on PropXchain.</p>;
  }
  if (keysRole !== 'agent' && keysRole !== 'seller') return null;
  return (
    <button type="button" onClick={onConfirm} disabled={busy} className={BUTTON}>
      Confirm keys released
    </button>
  );
}

export interface CompletionRowsProps {
  status: CompletionStatus;
  viewerSide: CompletionSide;
  keysRole: KeysRole;
  /** Completion has happened, so the keys row applies. */
  completed: boolean;
  busy: boolean;
  onConfirmSide: () => void;
  onConfirmKeys: () => void;
}

export function CompletionRows({
  status, viewerSide, keysRole, completed, busy, onConfirmSide, onConfirmKeys,
}: CompletionRowsProps): ReactNode {
  const action = (side: CompletionSide): ReactNode =>
    side === viewerSide && !completed
      ? <SideAction side={side} status={status} busy={busy} onConfirm={onConfirmSide} />
      : null;
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
