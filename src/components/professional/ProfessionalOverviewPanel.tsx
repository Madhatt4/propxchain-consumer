// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Professional overview panel (Ship 6).
 *
 * Aggregates reminders, forms progress, and completion stats across a
 * professional user's transactions so solicitors / conveyancers can
 * triage their book without clicking through every deal. Can be
 * dropped into any dashboard (ConveyancerDashboard, FirmDashboardPage,
 * etc.) by passing the list of transactions the caller already loaded.
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { icpService } from '../../services/icp.service';
import {
  buildProfessionalOverview,
  type ProfessionalOverview,
  type TransactionSnapshot,
} from '../../services/professionalOverview';

interface InputTransaction {
  id: string;
  propertyAddress?: string;
  buyer?: string;
  seller?: string;
  status?: unknown;
}

interface ProfessionalOverviewPanelProps {
  /** The professional's transactions, already loaded by the parent. */
  transactions: InputTransaction[];
  /** Test override — skip the event fetch + derivation. */
  overviewOverride?: ProfessionalOverview | null;
  /** Click handler so callers can wire up navigation to a transaction. */
  onTransactionClick?: (transactionId: string) => void;
}

function statusKey(raw: unknown): TransactionSnapshot['status'] {
  const allowed: TransactionSnapshot['status'][] = [
    'active',
    'exchanged',
    'completion_initiated',
    'blockchain_completed',
    'land_registry_registered',
  ];
  // Motoko variant shape: { active: null }, { exchanged: null }, etc.
  if (raw && typeof raw === 'object') {
    const keys = Object.keys(raw as object);
    if (keys.length > 0) {
      const k = keys[0] as TransactionSnapshot['status'];
      if ((allowed as string[]).includes(k)) return k;
    }
  }
  // Plain-string shape (as used in ConveyancerDashboard listings)
  if (typeof raw === 'string') {
    const k = raw as TransactionSnapshot['status'];
    if ((allowed as string[]).includes(k)) return k;
  }
  return 'active';
}

function normaliseTimestamp(ts: number): number {
  return ts > 4_102_444_800_000 ? Math.floor(ts / 1_000_000) : ts;
}

export function ProfessionalOverviewPanel({
  transactions,
  overviewOverride,
  onTransactionClick,
}: ProfessionalOverviewPanelProps): ReactElement | null {
  const [overview, setOverview] = useState<ProfessionalOverview | null>(overviewOverride ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(
    overviewOverride === undefined && transactions.length > 0,
  );

  useEffect(() => {
    if (overviewOverride !== undefined) {
      setOverview(overviewOverride);
      setIsLoading(false);
      return;
    }
    if (transactions.length === 0) {
      setOverview({
        stats: { total: 0, active: 0, exchanging: 0, completing: 0, completed: 0 },
        attention: [],
        transactions: [],
        formsTotals: {
          sellerFormsComplete: 0,
          searchesOrdered: 0,
          contractExchanged: 0,
          completed: 0,
        },
      });
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const snapshots = await Promise.all(
          transactions.map(async (tx): Promise<TransactionSnapshot> => {
            const eventsRaw = await icpService.ledgerManager?.getEventsByTransaction(tx.id);
            const events = Array.isArray(eventsRaw)
              ? eventsRaw.map((e) => ({
                  eventType: String(e.eventType ?? ''),
                  timestamp: normaliseTimestamp(Number(e.timestamp ?? 0)),
                }))
              : [];
            return {
              transactionId: tx.id,
              propertyAddress: String(tx.propertyAddress ?? 'Unknown address'),
              buyer: String(tx.buyer ?? ''),
              seller: String(tx.seller ?? ''),
              status: statusKey(tx.status),
              events,
            };
          }),
        );
        if (cancelled) return;
        setOverview(buildProfessionalOverview(snapshots, Date.now()));
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setOverview(null);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactions, overviewOverride]);

  if (isLoading) {
    return (
      <div
        className="mb-4 h-48 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-hidden="true"
      />
    );
  }

  if (!overview) return null;

  if (overview.stats.total === 0) {
    return (
      <section className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-6 text-center">
        <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
          No transactions to report on yet.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-4"
      aria-label="Professional overview"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[Fraunces] text-base font-semibold text-gray-900 dark:text-gray-50">
          Overview
        </h2>
        <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
          {overview.stats.total} {overview.stats.total === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>

      {/* Stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Active" value={overview.stats.active} />
        <StatTile label="Exchanging" value={overview.stats.exchanging} />
        <StatTile label="Completing" value={overview.stats.completing} />
        <StatTile label="Completed" value={overview.stats.completed} />
      </div>

      {/* Forms progress totals */}
      <div className="mb-4">
        <h3 className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Progress across book
        </h3>
        <ul className="mt-2 space-y-1 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-200">
          <ProgressRow
            label="Seller forms complete"
            numerator={overview.formsTotals.sellerFormsComplete}
            denominator={overview.stats.total}
          />
          <ProgressRow
            label="Searches ordered"
            numerator={overview.formsTotals.searchesOrdered}
            denominator={overview.stats.total}
          />
          <ProgressRow
            label="Contracts exchanged"
            numerator={overview.formsTotals.contractExchanged}
            denominator={overview.stats.total}
          />
          <ProgressRow
            label="Completed"
            numerator={overview.formsTotals.completed}
            denominator={overview.stats.total}
          />
        </ul>
      </div>

      {/* Attention items */}
      {overview.attention.length > 0 && (
        <div>
          <h3 className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Requires attention ({overview.attention.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {overview.attention.map((item, idx) => (
              <li
                key={`${item.transactionId}-${item.reminder.id}-${idx}`}
                className="rounded-md border-l-4 px-3 py-2"
                style={{ borderLeftColor: urgencyBorderColor(item.reminder.urgency) }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onTransactionClick?.(item.transactionId)}
                    className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-[#0D9488] dark:hover:text-[#14B8A6]"
                    disabled={!onTransactionClick}
                  >
                    {item.propertyAddress}
                  </button>
                  <UrgencyChip urgency={item.reminder.urgency} />
                </div>
                <p className="mt-0.5 font-[DM_Sans] text-xs text-gray-600 dark:text-gray-300">
                  {item.reminder.message}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div className="font-[Fraunces] text-2xl font-semibold text-[#0D9488] dark:text-[#14B8A6]">
        {value}
      </div>
      <div className="font-[DM_Sans] text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  numerator,
  denominator,
}: {
  label: string;
  numerator: number;
  denominator: number;
}): ReactElement {
  const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-[DM_Sans] text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {numerator} / {denominator} · {pct}%
      </span>
    </li>
  );
}

function UrgencyChip({ urgency }: { urgency: 'low' | 'medium' | 'high' | 'critical' }): ReactElement {
  const classes = {
    critical: 'bg-red-600 text-white',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  }[urgency];
  const label = urgency === 'critical' ? 'Critical' : urgency[0].toUpperCase() + urgency.slice(1);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-[DM_Sans] text-xs font-semibold ${classes}`}
      aria-label={`urgency ${urgency}`}
    >
      {label}
    </span>
  );
}

function urgencyBorderColor(urgency: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (urgency) {
    case 'critical':
      return '#dc2626';
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#3b82f6';
  }
}

export default ProfessionalOverviewPanel;
