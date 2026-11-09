// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Sales pack — the transaction's assembled upfront-information artefact
 * (decisions: Madhatt4/Propxchain#115, #116). Free on starter; both parties
 * see it, the seller acts on it.
 *
 * The readiness meter, plus an "other documents" slot (SalesPackDocuments)
 * whose files are stored with the deal and hashed on-chain. The buyer's side
 * reads the same list, filtered by document_storage's access matrix.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePackReadiness } from '@/hooks/usePackReadiness';
import { ExtraDocumentsSlot } from './SalesPackDocuments';
import { PackShareCard } from './PackShareCard';
import { viewOnlyNote } from '../ViewOnlyFrame';
import type { TransactionTabProps } from './transactionTabs.config';

/** Stage where the seller confirms tenure and council tax band. */
const LIST_PROPERTY_STAGE_ID = 'seller-1';

const ROW_ACTION =
  'ml-auto shrink-0 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300';

interface SalesPackTabExtraProps {
  /** Jump to a flow stage — wired by the flow page; absent elsewhere. */
  onGoToStage?: (stageId: string) => void;
  /**
   * The buyer sees the pack but only the seller's side acts on it
   * (lib/dealAccess `salesPack`): no uploads, no row actions, no share link.
   */
  readOnly?: boolean;
}

/**
 * Where an unfinished item is completed. Material info lives on the Stage 1
 * form (tenure and council tax band have no free source); proof of ID is
 * shared from the Transaction Wallet and is never part of the pack itself.
 */
function RowAction({
  itemId,
  transactionId,
  onGoToStage,
}: { itemId: string; transactionId: string; onGoToStage?: (stageId: string) => void }): JSX.Element | null {
  if (itemId === 'materialInfo' && onGoToStage) {
    return (
      <button type="button" className={ROW_ACTION} onClick={() => onGoToStage(LIST_PROPERTY_STAGE_ID)}>
        Complete in Stage 1
      </button>
    );
  }
  if (itemId === 'idShared') {
    return (
      <Link to={`/transaction/${transactionId}/flow?tab=wallet`} className={ROW_ACTION}>
        Share from wallet
      </Link>
    );
  }
  return null;
}

export function SalesPackTab({
  transactionId,
  onGoToStage,
  readOnly = false,
}: TransactionTabProps & SalesPackTabExtraProps): JSX.Element {
  const { readiness, isLoading } = usePackReadiness(transactionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700/60 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sales pack</h2>
          {readiness && (
            <span className="ml-auto text-sm font-semibold text-teal-700 dark:text-teal-300">
              {readiness.done} of {readiness.total}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The upfront information a buyer&apos;s side will ask for, gathered
          before they have to ask.{readOnly ? '' : ' Each item completes from its stage above.'}
        </p>
        {readOnly && (
          <p role="note" className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {viewOnlyNote('buyer')}
          </p>
        )}

        {readiness && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={readiness.total}
            aria-valuenow={readiness.done}
            aria-label="Sales pack readiness"
            className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
          >
            <div
              className="h-full rounded-full bg-teal-500 transition-[width]"
              style={{ width: `${readiness.total ? (readiness.done / readiness.total) * 100 : 0}%` }}
            />
          </div>
        )}

        {isLoading && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking your pack…</p>
        )}

        {readiness && readiness.warnings.length > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              The title register disagrees with the listing
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              {readiness.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {readiness && (
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-slate-700/40">
            {readiness.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    'text-sm',
                    item.done
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400',
                  )}
                >
                  {item.label}
                </span>
                <span className="sr-only">{item.done ? 'done' : 'not done'}</span>
                {!item.done && !readOnly && (
                  <RowAction itemId={item.id} transactionId={transactionId} onGoToStage={onGoToStage} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ExtraDocumentsSlot transactionId={transactionId} readOnly={readOnly} />

      {!readOnly && <PackShareCard transactionId={transactionId} />}
    </div>
  );
}
