/**
 * All-Transactions Audit Page — portfolio-scale blockchain audit ledger.
 * Route: /admin/audit (admin-gated — reads the whole transaction set).
 *
 * The per-transaction report lives at /transaction/:id/audit. This view
 * aggregates EVERY event across EVERY transaction: the "money-shot" evidencing
 * blockchain-verified audit at portfolio scale, plus surfaced integrity
 * anomalies the per-tx timeline buckets into "Other".
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, ShieldCheck, Activity, AlertTriangle,
  Layers, ListTree, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { logger } from '@/utils/logger';
import type { PortfolioAudit, TransactionGroup } from '../services/portfolioAudit';
import { fetchPortfolioAudit, ANOMALY_EVENT_TYPES } from '../services/portfolioAudit';

function formatTimestamp(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// SUBCOMPONENTS
// ============================================

interface StatCardProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: 'default' | 'warning';
}

function StatCard({ icon: Icon, label, value, accent = 'default' }: StatCardProps): React.ReactElement {
  const theme = useThemeClasses();
  const isWarn = accent === 'warning' && Number(value) > 0;
  return (
    <div className={`rounded-xl p-4 ${theme.cardBg} border ${theme.border}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${isWarn ? 'text-amber-500' : 'text-teal-500'}`} />
        <span className={`text-xs font-medium ${theme.textSecondary}`}>{label}</span>
      </div>
      <p className={`font-fraunces text-2xl font-bold ${isWarn ? 'text-amber-500' : theme.textPrimary}`}>
        {value}
      </p>
    </div>
  );
}

function EventTypeBar({ eventType, count, max }: { eventType: string; count: number; max: number }): React.ReactElement {
  const theme = useThemeClasses();
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const isAnomaly = ANOMALY_EVENT_TYPES.has(eventType);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`w-44 shrink-0 truncate ${theme.textSecondary}`} title={eventType}>
        {formatEventType(eventType)}
      </span>
      <div className={`flex-1 h-2.5 rounded-full ${theme.progressBarTrack}`}>
        <div
          className={`h-full rounded-full ${isAnomaly ? 'bg-amber-500' : 'bg-teal-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-10 text-right tabular-nums ${theme.textPrimary}`}>{count}</span>
    </div>
  );
}

function TransactionRow({ group }: { group: TransactionGroup }): React.ReactElement {
  const theme = useThemeClasses();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className={`rounded-lg border ${theme.border} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${theme.cardBg} hover:opacity-90 transition-opacity`}
      >
        <Chevron className={`w-4 h-4 shrink-0 ${theme.textTertiary}`} />
        <span className={`font-geist-mono text-xs truncate flex-1 ${theme.textPrimary}`}>
          {group.transactionId}
        </span>
        {group.anomalyCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {group.anomalyCount}
          </span>
        )}
        <span className={`text-xs tabular-nums ${theme.textSecondary}`}>
          {group.eventCount} events
        </span>
        <span className={`hidden sm:inline text-xs ${theme.textTertiary}`}>
          {formatTimestamp(group.lastTimestamp)}
        </span>
      </button>

      {open && (
        <ol className={`divide-y ${theme.border} border-t ${theme.border}`}>
          {group.events.map(ev => {
            const isAnomaly = ANOMALY_EVENT_TYPES.has(ev.eventType);
            return (
              <li key={ev.eventId} className={`flex items-start gap-3 px-4 py-2.5 ${theme.cardSecondary}`}>
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${isAnomaly ? 'bg-amber-500' : 'bg-teal-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${theme.textPrimary}`}>
                      {formatEventType(ev.eventType)}
                    </span>
                    <span className={`text-xs ${theme.textTertiary}`}>
                      {formatTimestamp(ev.timestamp / 1_000_000)}
                    </span>
                  </div>
                  {ev.details && (
                    <p className={`text-xs mt-0.5 break-words ${theme.textSecondary}`}>{ev.details}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ============================================
// PAGE
// ============================================

const AllTransactionsAuditPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useThemeClasses();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  const [audit, setAudit] = useState<PortfolioAudit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-admins once the admin check resolves (data is platform-wide).
  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate('/dashboard');
  }, [adminLoading, isAdmin, navigate]);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setAudit(await fetchPortfolioAudit());
    } catch (err) {
      logger.error('Portfolio audit fetch failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolio audit');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const maxTypeCount = audit?.eventTypeBreakdown[0]?.count ?? 0;

  return (
    <div className={`min-h-screen ${theme.pageBg}`}>
      <header className={`sticky top-0 z-10 ${theme.headerBg} px-4 py-3`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate('/admin')} className={`p-1.5 rounded-md ${theme.btnSecondary}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`font-fraunces text-lg font-bold ${theme.headerText}`}>Portfolio Audit Ledger</h1>
            <p className={`text-xs ${theme.headerSubtext}`}>
              Blockchain-verified · every event across every transaction
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isLoading ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />)}
            </div>
            <div className="h-40 rounded-xl bg-gray-200 dark:bg-gray-700" />
            <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
          </div>
        )}

        {!isLoading && error && (
          <div className={`rounded-lg p-8 text-center ${theme.cardBg}`}>
            <p className="text-red-500 mb-4">{error}</p>
            <button type="button" onClick={() => void load()} className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && audit && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Activity} label="Total Events" value={audit.totalEvents.toLocaleString()} />
              <StatCard icon={Layers} label="Transactions" value={audit.totalTransactions.toLocaleString()} />
              <StatCard icon={ListTree} label="Event Types" value={audit.distinctEventTypes} />
              <StatCard icon={AlertTriangle} label="Anomalies" value={audit.totalAnomalies} accent="warning" />
            </div>

            {/* Provenance + range */}
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${theme.textTertiary}`}>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                {audit.source.canister} · {audit.source.network.toUpperCase()} · {audit.source.canisterId}
              </span>
              <span>{formatTimestamp(audit.earliestTimestamp)} → {formatTimestamp(audit.latestTimestamp)}</span>
            </div>

            {/* Anomaly callout */}
            {audit.anomalies.length > 0 && (
              <section className="rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h2 className="font-fraunces font-bold text-amber-800 dark:text-amber-300">
                    Integrity anomalies ({audit.anomalies.length})
                  </h2>
                </div>
                <ul className="space-y-2">
                  {audit.anomalies.map(a => (
                    <li key={a.eventId} className="flex items-start gap-3 text-sm">
                      <span className="font-medium text-amber-800 dark:text-amber-300 shrink-0">
                        {formatEventType(a.eventType)}
                      </span>
                      <span className={`font-geist-mono text-xs truncate ${theme.textSecondary}`}>{a.transactionId}</span>
                      <span className={`text-xs ml-auto shrink-0 ${theme.textTertiary}`}>
                        {formatTimestamp(a.timestamp / 1_000_000)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Event-type breakdown */}
            {audit.eventTypeBreakdown.length > 0 && (
              <section className={`rounded-xl p-4 ${theme.cardBg} border ${theme.border}`}>
                <h2 className={`font-fraunces font-bold mb-3 ${theme.textPrimary}`}>Event types</h2>
                <div className="space-y-2">
                  {audit.eventTypeBreakdown.map(t => (
                    <EventTypeBar key={t.eventType} eventType={t.eventType} count={t.count} max={maxTypeCount} />
                  ))}
                </div>
              </section>
            )}

            {/* Per-transaction ledger */}
            <section className="space-y-2">
              <h2 className={`font-fraunces font-bold ${theme.textPrimary}`}>
                Transactions ({audit.totalTransactions})
              </h2>
              {audit.transactions.length === 0 ? (
                <p className={`text-sm ${theme.textSecondary}`}>No audit events recorded yet.</p>
              ) : (
                audit.transactions.map(g => <TransactionRow key={g.transactionId} group={g} />)
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AllTransactionsAuditPage;
