// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One numbered Sales pack row: number (or tick once real deal data says it is
 * done), title, "?" help, a status line, and at most one action. Layout and
 * labels follow the mock-up Marc signed off on 2026-11-15.
 *
 * The buyer (readOnly) sees only the marker, title and help: the status lines
 * are the seller's to-do guidance, not facts for the other side (Marc,
 * 2026-11-15).
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasPendingTitlePull } from '@/services/hmlrPullPending';
import { SALES_PACK_HELP } from './salesPackHelp';
import { PackHelpButton, PackHelpPanel } from './PackRowHelp';
import { MaterialInfoInlineForm } from './MaterialInfoInlineForm';
import { TitlePullAction } from './TitlePullAction';
import {
  FORMS_STAGE_ID,
  LIST_PROPERTY_STAGE_ID,
  PACK_ACTION_CLASS as ACTION,
  SEARCHES_STAGE_ID,
} from './salesPackStages';
import type { PackItem, PackItemId } from '@/services/salesPackReadiness';
import type { MaterialInfoGap } from '@/services/materialInfo';

/** Gaps the inline form cannot fill: they live in Stage 1's address block. */
const STAGE1_ONLY: MaterialInfoGap[] = ['address', 'postcode', 'price'];

const STAGE_ACTION: Partial<Record<PackItemId, { label: string; stageId: string }>> = {
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

type RowActionProps = Omit<PackRowProps, 'number' | 'isNext' | 'readOnly'>;

function RowAction({ item, transactionId, onGoToStage }: RowActionProps): JSX.Element | null {
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
  if (item.id === 'searches' && item.searchesState !== 'notOrdered') return null;
  const action = STAGE_ACTION[item.id];
  if (!action) return null;
  return (
    <button type="button" className={ACTION} onClick={() => onGoToStage(action.stageId)}>
      {action.label}{arrow}
    </button>
  );
}

interface RowMarkerProps {
  done: boolean;
  number: number;
  isNext: boolean;
}

function RowMarker({ done, number, isNext }: RowMarkerProps): JSX.Element {
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

export function PackRow({ item, number, isNext, transactionId, readOnly, onGoToStage }: PackRowProps): JSX.Element {
  const [isHelpOpen, setHelpOpen] = useState(false);
  // Set once a pull from this row succeeds: the refreshed readiness ticks the
  // row, but the button must stay mounted so its register modal stays open.
  const [hasPulledHere, setPulledHere] = useState(false);
  const panelId = useId();
  const showInlineForm = !readOnly && !item.done && item.id === 'materialInfo' && !needsStage1(item);
  const isMissingLine = item.id === 'materialInfo' && !item.done;
  const isTitleRow = item.id === 'titlePulled';
  // A pull paid for on this device but not yet delivered must resume (and
  // refund on failure) even when the row already reads done from an older
  // pull of the same title.
  const shouldShowTitlePull =
    !readOnly && isTitleRow && (!item.done || hasPulledHere || hasPendingTitlePull(transactionId));

  return (
    <li className="grid grid-cols-[28px_1fr_auto] items-start gap-2.5 py-2.5">
      <RowMarker done={item.done} number={number} isNext={isNext} />
      <div className="min-w-0">
        <span className={cn('text-sm', item.done ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-gray-100')}>
          {item.label}
        </span>
        <span className="sr-only">{item.done ? ', done' : ', not done'}</span>
        <PackHelpButton title={item.label} isOpen={isHelpOpen} panelId={panelId} onToggle={() => setHelpOpen((o) => !o)} />
        {!readOnly && item.status && (
          <p className={cn('text-xs', isMissingLine ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')}>
            {item.status}
          </p>
        )}
        {showInlineForm && <MaterialInfoInlineForm transactionId={transactionId} missing={item.missing ?? []} />}
        {isHelpOpen && <PackHelpPanel id={panelId} help={SALES_PACK_HELP[item.id]} />}
      </div>
      <div>
        {shouldShowTitlePull && (
          <TitlePullAction
            transactionId={transactionId}
            titleNumber={item.titleNumber}
            onGoToStage={onGoToStage}
            onPulled={() => setPulledHere(true)}
          />
        )}
        {!isTitleRow && !item.done && !readOnly && !showInlineForm && (
          <RowAction item={item} transactionId={transactionId} onGoToStage={onGoToStage} />
        )}
      </div>
    </li>
  );
}
