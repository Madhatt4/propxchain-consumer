// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { BuyerPackItem } from '@/services/buyerPack.service';
import { ITEM_HELP, ITEM_LABELS, describeItem, statusLabel } from './buyerPackLabels';

interface Props {
  item: BuyerPackItem;
  /** The buyer's own view shows what to do; the other side only sees the result. */
  showHelp: boolean;
  children?: ReactNode;
}

export function BuyerPackItemRow({ item, showHelp, children }: Props): JSX.Element {
  const Icon = item.status === 'ready' ? CheckCircle2 : item.status === 'in_progress' ? Loader2 : Circle;
  const iconClass = item.status === 'ready'
    ? 'text-teal-600 dark:text-teal-400'
    : item.status === 'in_progress'
      ? 'text-amber-500'
      : 'text-gray-300 dark:text-slate-600';
  return (
    <li className="py-3" data-testid={`pack-item-${item.item}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}${item.status === 'in_progress' ? ' animate-spin' : ''}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{ITEM_LABELS[item.item]}</p>
            <span className="text-xs text-muted-foreground">{statusLabel(item.status)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{describeItem(item)}</p>
          {showHelp && <p className="mt-0.5 text-xs text-muted-foreground">{ITEM_HELP[item.item]}</p>}
          {item.status === 'ready' && (
            <p className={`mt-0.5 text-xs ${item.onLedger ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {item.onLedger ? 'On the audit trail' : 'Not yet on the audit trail'}
            </p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </li>
  );
}
