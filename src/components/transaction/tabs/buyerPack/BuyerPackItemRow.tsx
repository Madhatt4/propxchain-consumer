// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One numbered Buyer pack row, the same shape as the Sales pack's: number (a
 * tick once ready), title, "?" help, the one-line result, the row's controls.
 * The seller's side sees tick, title and result only: that line is the
 * buyer's declaration they need. Help, actions and controls are the buyer's.
 */
import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuyerPackItem } from '@/services/buyerPack.service';
import { PackHelpButton, PackHelpPanel } from '../PackRowHelp';
import { BUYER_PACK_HELP } from './buyerPackHelp';
import { describeItem, itemLabel } from './buyerPackLabels';

interface BuyerPackItemRowProps {
  item: BuyerPackItem;
  number: number;
  isNext: boolean;
  /** Only the buyer gets the "?" help; the other side reads the result. */
  showHelp: boolean;
  /** The row's one action (a link or button), top right. */
  action?: ReactNode;
  /** Inline declaration controls under the result line. */
  children?: ReactNode;
}

interface MarkerProps {
  isDone: boolean;
  number: number;
  isNext: boolean;
}

function Marker({ isDone, number, isNext }: MarkerProps): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-px flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-xs',
        isDone && 'border-teal-600 bg-teal-600 text-white',
        !isDone && isNext && 'border-teal-600 font-bold text-teal-700 dark:text-teal-300',
        !isDone && !isNext && 'border-gray-300 text-gray-500 dark:border-slate-600 dark:text-slate-400',
      )}
    >
      {isDone ? <Check className="h-3.5 w-3.5" /> : number}
    </span>
  );
}

export function BuyerPackItemRow({
  item, number, isNext, showHelp, action, children,
}: BuyerPackItemRowProps): JSX.Element {
  const [isHelpOpen, setHelpOpen] = useState(false);
  const isDone = item.status === 'ready';
  const title = itemLabel(item.item);
  const help = showHelp ? BUYER_PACK_HELP[item.item] : undefined;
  const panelId = `buyer-pack-help-${item.item}`;
  const ledgerTone = item.onLedger ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300';
  return (
    <li className="grid grid-cols-[28px_1fr_auto] items-start gap-2.5 py-2.5" data-testid={`pack-item-${item.item}`}>
      <Marker isDone={isDone} number={number} isNext={isNext} />
      <div className="min-w-0">
        <span className={cn('text-sm', isDone ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-gray-100')}>
          {title}
        </span>
        <span className="sr-only">{isDone ? ', done' : ', not done'}</span>
        {help && <PackHelpButton title={title} isOpen={isHelpOpen} panelId={panelId} onToggle={() => setHelpOpen((o) => !o)} />}
        <p className="text-xs text-gray-500 dark:text-gray-400">{describeItem(item)}</p>
        {isDone && (
          <p className={cn('mt-0.5 text-xs', ledgerTone)}>
            {item.onLedger ? 'On the audit trail' : 'Not yet on the audit trail'}
          </p>
        )}
        {help && isHelpOpen && <PackHelpPanel id={panelId} help={help} />}
        {children && <div className="mt-2">{children}</div>}
      </div>
      <div>{action}</div>
    </li>
  );
}
