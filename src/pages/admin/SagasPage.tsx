// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Admin page for inspecting stuck reservations and saga failures.
 * Route: /admin/sagas
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { observability } from '@/services/observability.service';
import AppTopBar from '@/components/navigation/AppTopBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StuckSaga {
  id: string;
  plot_number: string;
  site_id: string;
  site_name: string;
  reservation_status: string;
  last_error: string | null;
  updated_at: string;
}

const REFRESH_INTERVAL_MS = 30_000;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SagasPage: React.FC = () => {
  const navigate = useNavigate();
  const [sagas, setSagas] = useState<StuckSaga[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const fetchStuckSagas = useCallback(async (): Promise<void> => {
    try {
      const { data, error: queryError } = await supabase
        .from('plots')
        .select('id, plot_number, site_id, reservation_status, last_error, updated_at, development_sites(name)')
        .or('reservation_status.eq.pending,last_error.not.is.null')
        .order('updated_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        observability.error('Failed to fetch stuck sagas', { error: queryError.message });
        return;
      }

      const mapped: StuckSaga[] = (data ?? []).map((row: Record<string, unknown>) => {
        const site = row.development_sites as { name: string } | null;
        return {
          id: row.id as string,
          plot_number: row.plot_number as string,
          site_id: row.site_id as string,
          site_name: site?.name ?? 'Unknown site',
          reservation_status: row.reservation_status as string,
          last_error: row.last_error as string | null,
          updated_at: row.updated_at as string,
        };
      });

      setSagas(mapped);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      observability.error('Stuck sagas fetch threw', { error: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStuckSagas();
    const interval = setInterval(fetchStuckSagas, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStuckSagas]);

  const handleRetry = async (plotId: string): Promise<void> => {
    setActionInFlight(plotId);
    const correlationId = observability.generateCorrelationId();
    observability.info('Retrying saga', { plotId, correlationId });

    try {
      const { error: updateError } = await supabase
        .from('plots')
        .update({ reservation_status: 'pending', last_error: null })
        .eq('id', plotId);

      if (updateError) {
        observability.error('Retry failed', { plotId, error: updateError.message, correlationId });
      } else {
        await fetchStuckSagas();
      }
    } finally {
      setActionInFlight(null);
    }
  };

  const handleRelease = async (plotId: string): Promise<void> => {
    setActionInFlight(plotId);
    const correlationId = observability.generateCorrelationId();
    observability.info('Releasing reservation', { plotId, correlationId });

    try {
      const { error: updateError } = await supabase
        .from('plots')
        .update({ reservation_status: 'available', last_error: null })
        .eq('id', plotId);

      if (updateError) {
        observability.error('Release failed', { plotId, error: updateError.message, correlationId });
      } else {
        await fetchStuckSagas();
      }
    } finally {
      setActionInFlight(null);
    }
  };

  const toggleExpand = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#060B18]">
      <AppTopBar title="Reservation sagas" backTo="/admin" backLabel="Back to admin" isAdmin />
      <main className="p-6 lg:p-8">
        <h1 className="font-fraunces text-3xl font-semibold text-[#1A1A1A] dark:text-[#F1F5F9] mb-6">
          Reservation Sagas
        </h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4 font-dm-sans text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
          </div>
        ) : sagas.length === 0 ? (
          <EmptyState />
        ) : (
          <SagaTable
            sagas={sagas}
            expandedIds={expandedIds}
            actionInFlight={actionInFlight}
            onToggleExpand={toggleExpand}
            onRetry={handleRetry}
            onRelease={handleRelease}
            onViewPlot={(siteId, plotId) => navigate(`/builder/sites/${siteId}/plots/${plotId}/edit`)}
          />
        )}
      </main>
    </div>
  );
};

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-dm-sans text-lg font-medium text-[#1A1A1A] dark:text-[#F1F5F9]">
        No stuck sagas
      </p>
      <p className="font-dm-sans text-sm text-[#6B7280] dark:text-[#94A3B8] mt-1">
        All reservations are healthy.
      </p>
    </div>
  );
}

interface SagaTableProps {
  sagas: StuckSaga[];
  expandedIds: Set<string>;
  actionInFlight: string | null;
  onToggleExpand: (id: string) => void;
  onRetry: (id: string) => Promise<void>;
  onRelease: (id: string) => Promise<void>;
  onViewPlot: (siteId: string, plotId: string) => void;
}

function SagaTable({
  sagas,
  expandedIds,
  actionInFlight,
  onToggleExpand,
  onRetry,
  onRelease,
  onViewPlot,
}: SagaTableProps): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] dark:border-gray-700">
      <table className="w-full font-dm-sans text-sm">
        <thead>
          <tr className="bg-teal-600 dark:bg-teal-800 text-white">
            <th className="px-4 py-3 text-left font-medium">Plot</th>
            <th className="px-4 py-3 text-left font-medium">Site</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Last Error</th>
            <th className="px-4 py-3 text-left font-medium font-geist-mono">Updated</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sagas.map((saga, idx) => {
            const isExpanded = expandedIds.has(saga.id);
            const hasError = saga.last_error !== null;
            const isBusy = actionInFlight === saga.id;

            return (
              <tr
                key={saga.id}
                className={cn(
                  idx % 2 === 0
                    ? 'bg-white dark:bg-[#0F1729]'
                    : 'bg-[#F0F5F0] dark:bg-[#141F33]',
                  hasError && 'border-l-[3px] border-red-500',
                )}
              >
                <td className="px-4 py-3 font-geist-mono">{saga.plot_number}</td>
                <td className="px-4 py-3">{saga.site_name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={saga.reservation_status} />
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {saga.last_error ? (
                    <button
                      type="button"
                      onClick={() => onToggleExpand(saga.id)}
                      className="text-left text-red-600 dark:text-red-400 hover:underline cursor-pointer font-geist-mono text-xs"
                    >
                      {isExpanded ? saga.last_error : truncate(saga.last_error, 60)}
                    </button>
                  ) : (
                    <span className="text-[#6B7280] dark:text-[#94A3B8]">--</span>
                  )}
                </td>
                <td className="px-4 py-3 font-geist-mono text-xs text-[#6B7280] dark:text-[#94A3B8]">
                  {formatTimestamp(saga.updated_at)}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => onRetry(saga.id)}
                    className="text-xs"
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => onRelease(saga.id)}
                    className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  >
                    Release
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewPlot(saga.site_id, saga.id)}
                    className="text-xs"
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    reserved: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  };

  return (
    <span className={cn(
      'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
      styles[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    )}>
      {status}
    </span>
  );
}

export default SagasPage;
