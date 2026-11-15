// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One numbered Sales pack row: number (or tick once real deal data says it is
 * done), title, "?" help, a status line, and at most one action. Layout and
 * labels follow the mock-up Marc signed off on 2026-11-15.
 */
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEARCHES_NOT_ORDERED, type PackItem, type PackItemId } from '@/services/salesPackReadiness';
import type { MaterialInfoGap } from '@/services/materialInfo';
import { SALES_PACK_HELP } from './salesPackHelp';
import { PackHelpButton, PackHelpPanel } from './PackRowHelp';
import { MaterialInfoInlineForm } from './MaterialInfoInlineForm';

/** Flow stages each row's work lives in (useTransactionFlow / dealAccess). */
const LIST_PROPERTY_STAGE_ID = 'seller-1'; // listing form + HMLR title pull
const SEARCHES_STAGE_ID = 'seller-2';
const FORMS_STAGE_ID = 'seller-3'; // TA6, TA10, TA7

/** Gaps the inline form cannot fill: they live in Stage 1's address block. */
const STAGE1_ONLY: MaterialInfoGap[] = ['address', 'postcode', 'price'];

const ACTION =
  'shrink-0 whitespace-nowrap text-[13px] font-semibold text-teal-700 hover:underline dark:text-teal-300';

const STAGE_ACTION: Partial<Record<PackItemId, { label: string; stageId: string }>> = {
  titlePulled: { label: 'Get it for £7', stageId: LIST_PROPERTY_STAGE_ID },
  ta6: { label: 'Start form', stageId: FORMS_STAGE_ID },
  ta10: { label: 'Start form', stageId: FORMS_STAGE_ID },
  ta7: { label: 'Start form', stageId: FORMS_STAGE_ID },
  searches: { label: 'Choose searches', stageId: SEARCHES_STAGE_ID },
};

export interface PackRowProps {
  item: PackItem;
  number: number;
  isNext: boolean;
  transactionId: string;
  readOnly: boolean;
  onGoToStage?: (stageId: string) => void;
}

function needsStage1(item: PackItem): boolean {
  return item.id === 'materialInfo' && (item.missing ?? []).some((f) => STAGE1_ONLY.includes(f));
}

function RowAction({ item, transactionId, onGoToStage }: Omit<PackRowProps, 'number' | 'isNext' | 'readOnly'>): ReactNode {
  const arrow = <span aria-hidden="true"> &rsaquo;</span>;
  if (item.id === 'idShared') {
    return (
      <Link to={`/transaction/${transactionId}/flow?tab=wallet`} className={ACTION}>
        Share from wallet{arrow}
      </Link>
    );
  }
  if (!onGoToStage) return null;
  if (needsStage1(item)) {
    return (
      <button type="button" className={ACTION} onClick={() => onGoToStage(LIST_PROPERTY_STAGE_ID)}>
        Fix in Stage 1{arrow}
      </button>
    );
  }
  // Ordered searches are waiting on the provider: nothing for the seller to do.
  if (item.id === 'searches' && item.status !== SEARCHES_NOT_ORDERED) return null;
  const action = STAGE_ACTION[item.id];
  if (!action) return null;
  return (
    <button type="button" className={ACTION} onClick={() => onGoToStage(action.stageId)}>
      {action.label}{arrow}
    </button>
  );
}

function RowMarker({ done, number, isNext }: { done: boolean; number: number; isNext: boolean }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-px flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-xs',
        done && 'border-teal-600 bg-teal-600 text-white',
        !done && isNext && 'border-teal-600 font-bold text-teal-700 dark:text-teal-300',
        !done && !isNext && 'border-gray-300 text-gray-500 dark:border-slate-600 dark:text-slate-400',
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : number}
    </span>
  );
}

export function PackRow({ item, number, isNext, transactionId, readOnly, onGoToStage }: PackRowProps): ReactNode {
  const [isHelpOpen, setHelpOpen] = useState(false);
  const panelId = useId();
  const showInlineForm = !readOnly && !item.done && item.id === 'materialInfo' && !needsStage1(item);
  const isMissingLine = item.id === 'materialInfo' && !item.done;

  return (
    <li className="grid grid-cols-[28px_1fr_auto] items-start gap-2.5 py-2.5">
      <RowMarker done={item.done} number={number} isNext={isNext} />
      <div className="min-w-0">
        <span className={cn('text-sm', item.done ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-gray-100')}>
          {item.label}
        </span>
        <span className="sr-only">{item.done ? ', done' : ', not done'}</span>
        <PackHelpButton title={item.label} isOpen={isHelpOpen} panelId={panelId} onToggle={() => setHelpOpen((o) => !o)} />
        {item.status && (
          <p className={cn('text-xs', isMissingLine ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')}>
            {item.status}
          </p>
        )}
        {showInlineForm && <MaterialInfoInlineForm transactionId={transactionId} missing={item.missing ?? []} />}
        {isHelpOpen && <PackHelpPanel id={panelId} help={SALES_PACK_HELP[item.id]} />}
      </div>
      <div>
        {!item.done && !readOnly && !showInlineForm && (
          <RowAction item={item} transactionId={transactionId} onGoToStage={onGoToStage} />
        )}
      </div>
    </li>
  );
}
