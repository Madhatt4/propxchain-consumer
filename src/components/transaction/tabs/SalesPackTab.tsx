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
import { AlertTriangle, Package } from 'lucide-react';
import { usePackReadiness } from '@/hooks/usePackReadiness';
import { ExtraDocumentsSlot } from './SalesPackDocuments';
import { PackShareCard } from './PackShareCard';
import { PackRow } from './PackRow';
import { viewOnlyNote } from '../ViewOnlyFrame';
import type { PackReadiness } from '@/services/salesPackReadiness';
import type { TransactionTabProps } from './transactionTabs.config';

interface SalesPackTabExtraProps {
  /** Jump to a flow stage — wired by the flow page; absent elsewhere. */
  onGoToStage?: (stageId: string) => void;
  /**
   * The buyer sees the pack but only the seller's side acts on it
   * (lib/dealAccess `salesPack`): no uploads, no row actions, no share link.
   */
  readOnly?: boolean;
}

interface RegisterWarningsProps {
  warnings: string[];
}

function RegisterWarnings({ warnings }: RegisterWarningsProps): JSX.Element | null {
  if (warnings.length === 0) return null;
  return (
    <div
      role="alert"
      className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        The title register disagrees with the listing
      </p>
      <ul className="mt-1.5 list-inside list-disc space-y-1">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

interface PackListProps {
  readiness: PackReadiness;
  transactionId: string;
  readOnly: boolean;
  onGoToStage?: (stageId: string) => void;
}

/** Numbered rows; numbers re-flow because they come from position, and the
 *  readiness service already drops TA7 when tenure rules leasehold out. */
function PackList({ readiness, transactionId, readOnly, onGoToStage }: PackListProps): JSX.Element {
  const next = readiness.items.find((i) => !i.done);
  return (
    <>
      <p className="mt-1.5 text-[13px] text-teal-800 dark:text-teal-300">
        {next ? `Next: ${next.label}` : 'Pack complete'}
      </p>
      <RegisterWarnings warnings={readiness.warnings} />
      <ol aria-label="Sales pack steps" className="mt-3 divide-y divide-gray-100 dark:divide-slate-700/40">
        {readiness.items.map((item, index) => (
          <PackRow
            key={item.id}
            item={item}
            number={index + 1}
            isNext={item === next}
            transactionId={transactionId}
            readOnly={readOnly}
            onGoToStage={onGoToStage}
          />
        ))}
      </ol>
    </>
  );
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
          What a buyer&apos;s conveyancer will ask for, ready before they ask.
          {readOnly ? '' : ' Work down the list. Each step takes you to the right place.'}
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
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
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

        {readiness && (
          <PackList readiness={readiness} transactionId={transactionId} readOnly={readOnly} onGoToStage={onGoToStage} />
        )}
      </div>

      <ExtraDocumentsSlot transactionId={transactionId} readOnly={readOnly} />

      {!readOnly && <PackShareCard transactionId={transactionId} />}
    </div>
  );
}
