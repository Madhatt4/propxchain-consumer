// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One plot, laid out the way a transaction is on the user dashboard: a
 * header card with the price and status, the progress timeline, then a
 * two-column grid of cards. A builder clicking a plot should land somewhere
 * that looks like the rest of the app, not a form.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Loader2, Pencil, ShieldAlert } from 'lucide-react';
import { plotsService, type Plot } from '@/services/plots.service';
import { plotTypesService, type PlotType } from '@/services/plot-types.service';
import { sitesService, type DevelopmentSite } from '@/services/sites.service';
import TransactionProgressTimeline from '@/components/dashboard/TransactionProgressTimeline';
import NextStepCard from '@/components/common/NextStepCard';
import { logger } from '@/utils/logger';
import { daysToCompletion, plotCompletionPercent, plotSteps } from './plotProgress';

function formatPrice(pence: number | null): string {
  if (pence == null) return 'Price TBC';
  return `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function humanise(status: string | null): string {
  if (!status) return 'Not started';
  return status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

interface Loaded {
  plot: Plot;
  site: DevelopmentSite;
  plotType: PlotType | null;
}

export default function PlotDetailPage(): JSX.Element {
  const { siteId, plotId } = useParams<{ siteId: string; plotId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!siteId || !plotId) return;
    let cancelled = false;
    (async () => {
      try {
        const [plot, site] = await Promise.all([plotsService.getById(plotId), sitesService.getById(siteId)]);
        const plotType = plot.plot_type_id ? await plotTypesService.getById(plot.plot_type_id) : null;
        if (!cancelled) setData({ plot, site, plotType });
      } catch (err) {
        logger.error('Failed to load plot', err);
        if (!cancelled) setError('Could not load this plot. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, plotId]);

  async function handleToggleAtRisk(): Promise<void> {
    if (!data) return;
    setIsToggling(true);
    try {
      const updated = await plotsService.update(data.plot.id, {
        at_risk_flag: !data.plot.at_risk_flag,
        at_risk_reason: data.plot.at_risk_flag ? null : data.plot.at_risk_reason,
      });
      setData({ ...data, plot: updated });
    } catch (err) {
      logger.error('Failed to toggle at-risk flag', err);
    } finally {
      setIsToggling(false);
    }
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="font-[DM_Sans] text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" aria-label="Loading plot" />
      </div>
    );
  }

  const { plot, site, plotType } = data;
  const title = `Plot ${plot.plot_number}`;
  const isReserved = plot.reservation_status === 'reserved';
  const features = [...(plotType?.features ?? []), ...plot.features_addendum];

  return (
    <div className="py-6">
      <section className="progress-section mb-4 sm:mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="m-0 break-words text-lg text-[var(--text-main)] sm:text-2xl">{title}</h2>
              <span
                className={`${isReserved ? 'border-[#84A98C]/40 bg-[#84A98C]/15 text-[#5F8A68] dark:text-[#9CB8A4]' : 'border-[var(--border-color)] bg-[var(--bg-section)] text-[var(--text-secondary)]'} whitespace-nowrap rounded-md border px-3 py-1 text-xs font-semibold sm:text-[13px]`}
              >
                {isReserved ? 'Reserved' : 'Available'}
              </span>
              <span
                className={`${plot.listing_status === 'published' ? 'border-[#0D9488]/30 bg-[#0D9488]/10 text-[#0D9488]' : 'border-[var(--border-color)] bg-[var(--bg-section)] text-[var(--text-secondary)]'} whitespace-nowrap rounded-md border px-3 py-1 text-xs font-semibold capitalize sm:text-[13px]`}
              >
                {plot.listing_status}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
              {formatPrice(plot.sale_price_pence)} • {plotType?.name ?? 'Untyped'} • {site.name}
              <span className="ml-2 rounded bg-[var(--bg-section)] px-2 py-0.5 font-mono text-xs">{site.postcode}</span>
            </p>
            {features.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {features.slice(0, 6).map((feature) => (
                  <span key={feature} className="rounded bg-[var(--bg-section)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                    {feature}
                  </span>
                ))}
                {features.length > 6 && (
                  <span className="py-1 text-xs text-[var(--text-muted)]">+{features.length - 6} more</span>
                )}
              </div>
            )}
          </div>
          <Link
            to={`/builder/sites/${siteId}/plots/${plot.id}/edit`}
            className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-[var(--bg-section)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-light)] hover:text-[var(--text-main)]"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </section>

      {plot.at_risk_flag && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--status-waiting-border)] bg-[var(--status-waiting-bg)] p-4 sm:mb-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-waiting-text)]" />
          <div>
            <p className="font-[DM_Sans] text-sm font-medium text-[var(--status-waiting-text)]">At risk</p>
            {plot.at_risk_reason && (
              <p className="mt-0.5 font-[DM_Sans] text-xs text-[var(--status-waiting-text)]">{plot.at_risk_reason}</p>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 sm:mb-6">
        <TransactionProgressTimeline
          steps={plotSteps(plot)}
          propertyAddress={`${title}, ${site.name}`}
          completionPercentage={plotCompletionPercent(plot)}
          estimatedDays={daysToCompletion(plot)}
          isReadyToSign={false}
          onViewProgress={plot.transaction_id ? () => navigate(`/transaction/${plot.transaction_id}/flow`) : undefined}
        />
      </div>

      {plot.transaction_id && (
        <div className="mb-4 sm:mb-6">
          <NextStepCard txId={plot.transaction_id} variant="compact" />
        </div>
      )}

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Reservation</h3>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--text-muted)]">Status</dt>
            <dd className="m-0 text-[var(--text-main)]">{isReserved ? 'Reserved' : 'Available'}</dd>
            <dt className="text-[var(--text-muted)]">Reserved on</dt>
            <dd className="m-0 text-[var(--text-main)]">{formatDate(plot.reserved_at)}</dd>
            <dt className="text-[var(--text-muted)]">Transaction</dt>
            <dd className="m-0">
              {plot.transaction_id ? (
                <Link
                  to={`/transaction/${plot.transaction_id}/flow`}
                  className="inline-flex items-center gap-1 text-[#0D9488] hover:underline"
                >
                  Open transaction <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="text-[var(--text-main)]">None yet</span>
              )}
            </dd>
          </dl>
        </section>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Build & legal</h3>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--text-muted)]">Build stage</dt>
            <dd className="m-0 text-[var(--text-main)]">{humanise(plot.current_build_status)}</dd>
            <dt className="text-[var(--text-muted)]">Legal stage</dt>
            <dd className="m-0 text-[var(--text-main)]">{humanise(plot.current_legal_status)}</dd>
            <dt className="text-[var(--text-muted)]">Practical completion</dt>
            <dd className="m-0 text-[var(--text-main)]">{formatDate(plot.expected_practical_completion)}</dd>
          </dl>
        </section>

        <section className="card card-row-full">
          <div className="card-header">
            <h3 className="card-title">Actions</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggleAtRisk}
              disabled={isToggling}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[#0D9488] hover:text-[#0D9488] disabled:opacity-50"
            >
              <ShieldAlert className="h-4 w-4" />
              {plot.at_risk_flag ? 'Clear at-risk flag' : 'Mark at risk'}
            </button>
            <Link
              to={`/builder/sites/${siteId}/pipeline`}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[#0D9488] hover:text-[#0D9488]"
            >
              View on pipeline
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
