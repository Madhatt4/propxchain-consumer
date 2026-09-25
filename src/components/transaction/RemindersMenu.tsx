// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Reminders (Ship 4b).
 *
 * Active delay / urgency reminders for a transaction, sorted by severity.
 * Fetches transaction + audit events, derives reminders via the pure
 * remindersService. Renders nothing if all rules pass — quiet when there's
 * nothing to nag about.
 *
 * Presented as a count pill in the transaction context strip that opens the
 * full list in a popover, following the running-total control beside it. The
 * list used to sit inline on the page, where it pushed the actual work down.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

import { icpService } from '../../services/icp.service';
import {
  generateReminders,
  type Reminder,
  type ReminderInput,
} from '../../services/remindersService';

interface RemindersMenuProps {
  transactionId: string;
  /** Test override — skip the live fetch and render these reminders directly. */
  remindersOverride?: Reminder[] | null;
}

type TransactionStatusKey = ReminderInput['status'];

function statusKey(status: unknown): TransactionStatusKey {
  if (status && typeof status === 'object') {
    const keys = Object.keys(status);
    if (keys.length > 0) {
      const k = keys[0] as TransactionStatusKey;
      const allowed: TransactionStatusKey[] = [
        'active',
        'exchanged',
        'completion_initiated',
        'blockchain_completed',
        'land_registry_registered',
      ];
      if (allowed.includes(k)) return k;
    }
  }
  return 'active';
}

export function RemindersMenu({
  transactionId,
  remindersOverride,
}: RemindersMenuProps): ReactElement | null {
  const [reminders, setReminders] = useState<Reminder[]>(remindersOverride ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(remindersOverride === undefined);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (remindersOverride !== undefined) {
      setReminders(remindersOverride ?? []);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const [txResult, eventsResult] = await Promise.allSettled([
          icpService.transactionManager?.getTransaction(transactionId),
          icpService.ledgerManager?.getEventsByTransaction(transactionId),
        ]);
        if (cancelled) return;

        const txRaw = txResult.status === 'fulfilled' ? txResult.value : null;
        const tx = Array.isArray(txRaw)
          ? (txRaw[0] as Record<string, unknown> | undefined)
          : (txRaw as Record<string, unknown> | null | undefined);
        if (!tx) {
          setReminders([]);
          setIsLoading(false);
          return;
        }

        const eventsRaw = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
        const events = Array.isArray(eventsRaw)
          ? eventsRaw.map((e) => ({
              eventType: String(e.eventType ?? ''),
              // Ledger timestamps can be big (nanoseconds). Normalise to ms.
              timestamp: normaliseTimestamp(Number(e.timestamp ?? 0)),
            }))
          : [];

        const result = generateReminders({
          status: statusKey(tx.status),
          buyer: String(tx.buyer ?? ''),
          seller: String(tx.seller ?? ''),
          events,
          now: Date.now(),
        });
        setReminders(result);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setReminders([]);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId, remindersOverride]);

  // Quiet while loading and quiet when there is nothing to nag about — the
  // strip should not reserve space for a control that may never appear.
  if (isLoading || reminders.length === 0) return null;

  const countLabel = `${reminders.length} ${reminders.length === 1 ? 'item' : 'items'}`;
  const worst = reminders[0].urgency;

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-semibold transition-colors duration-200 ease-out ${triggerClasses(worst)}`}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Reminders</span>
        <span className="opacity-80">· {countLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <section
          aria-label="Transaction reminders"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Reminders
            </span>
            <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
              {countLabel}
            </span>
          </div>
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-md border-l-4 px-3 py-2"
                style={{ borderLeftColor: urgencyBorderColor(r.urgency) }}
              >
                <UrgencyBadge urgency={r.urgency} />
                <div className="flex-1 min-w-0">
                  <p className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-100">
                    {r.message}
                  </p>
                  <p className="mt-0.5 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
                    {r.suggestedAction}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Trigger takes its colour from the worst outstanding reminder. */
function triggerClasses(urgency: Reminder['urgency']): string {
  switch (urgency) {
    case 'critical':
      return 'bg-red-600 text-white hover:bg-red-700';
    case 'high':
      return 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70';
    case 'medium':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70';
    case 'low':
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
  }
}

function UrgencyBadge({ urgency }: { urgency: Reminder['urgency'] }): ReactElement {
  const label = urgency === 'critical' ? 'Critical' : urgency[0].toUpperCase() + urgency.slice(1);
  const classes = urgencyBadgeClasses(urgency);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-[DM_Sans] text-xs font-semibold ${classes}`}
      aria-label={`urgency ${urgency}`}
    >
      {label}
    </span>
  );
}

function urgencyBadgeClasses(urgency: Reminder['urgency']): string {
  switch (urgency) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    case 'medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';
    case 'low':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
  }
}

function urgencyBorderColor(urgency: Reminder['urgency']): string {
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

function normaliseTimestamp(ts: number): number {
  // ledger timestamps are in nanoseconds if they exceed ~year 2100 in ms
  return ts > 4_102_444_800_000 ? Math.floor(ts / 1_000_000) : ts;
}

export default RemindersMenu;
