// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Builder dashboard shell. Renders empty state when no sites exist,
 * or the site list when sites are present (wave 1b placeholder).
 *
 * Five interaction states: loading, empty, error, success, partial.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import { useMembershipsQuery } from '@/router/useMembershipsQuery';
import { sitesService, type DevelopmentSite } from '@/services/sites.service';
import { plotsService, type Plot } from '@/services/plots.service';
import NextStepCard from '@/components/common/NextStepCard';
import { ProfessionalOverviewPanel } from '@/components/professional/ProfessionalOverviewPanel';
import { toOverviewStatus } from '@/components/professional/toOverviewStatus';

import BuilderEmptyPage from './BuilderEmptyPage';

type DashboardState = 'loading' | 'empty' | 'error' | 'success' | 'partial';

function deriveState(
  isLoading: boolean,
  hasError: boolean,
  sites: DevelopmentSite[],
): DashboardState {
  if (isLoading) return 'loading';
  if (hasError) return 'error';
  if (sites.length === 0) return 'empty';
  // Partial: at least one site exists but none are fully configured (wave 1b)
  return 'success';
}

function LoadingSkeleton(): JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="h-8 w-64 animate-pulse rounded-md bg-[var(--bg-section)]" />
      <div className="mt-4 h-4 w-96 animate-pulse rounded-md bg-[var(--bg-section)]" />
      <div className="mt-8 h-10 w-48 animate-pulse rounded-lg bg-[var(--bg-section)]" />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-sans text-base text-red-600 dark:text-red-400">
        Something went wrong loading your sites.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center rounded-lg bg-teal-600 px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:bg-teal-500 dark:hover:bg-teal-400"
      >
        Retry
      </button>
    </div>
  );
}

/** A plot that has reached conveyancing, paired with the site it belongs to. */
interface LinkedPlot {
  plot: Plot;
  site: DevelopmentSite;
}

/**
 * Every plot across the developer's sites that has a transaction behind it.
 *
 * One fetch, two consumers: the overview panel needs the whole set to rank
 * them, the next-step stack needs the first few. Fetching twice would double
 * the round-trips for identical data.
 */
function useLinkedPlots(sites: DevelopmentSite[]): LinkedPlot[] {
  const [linked, setLinked] = useState<LinkedPlot[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const plotsBySite = await Promise.all(
          sites.map((s) => plotsService.getBySite(s.id).catch((): Plot[] => [])),
        );
        if (cancelled) return;
        setLinked(
          plotsBySite.flatMap((plots, i) =>
            plots
              .filter((p) => Boolean(p.transaction_id))
              .map((plot) => ({ plot, site: sites[i] })),
          ),
        );
      } catch {
        if (!cancelled) setLinked([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sites]);
  return linked;
}

/**
 * F.4 — Cross-site next-step stack, now sitting under the overview panel.
 *
 * The panel answers "which of my plots needs me, most urgent first" across
 * the whole portfolio; this keeps the per-plot AI next step for the first
 * few. Order here is still "first 3 linked plots" — the panel is what
 * provides real prioritisation, which is why it renders above.
 */
function CrossSiteBlockerStack({ linkedPlots }: { linkedPlots: LinkedPlot[] }): JSX.Element | null {
  const txIds = linkedPlots
    .map(({ plot }) => plot.transaction_id)
    .filter((id): id is string => Boolean(id))
    .slice(0, 3);

  if (txIds.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-[Fraunces] text-lg font-semibold text-[var(--text-main)]">
        Top blockers across your sites
      </h2>
      <div className="mt-3 space-y-3">
        {txIds.map((id) => (
          <NextStepCard key={id} txId={id} variant="compact" />
        ))}
      </div>
    </section>
  );
}

/**
 * Portfolio-wide triage: stats, urgency-ranked attention items and forms
 * progress across every plot in conveyancing. Renders nothing until at least
 * one plot has a transaction — before that there is nothing on-chain to
 * summarise.
 */
function PortfolioOverview({ linkedPlots }: { linkedPlots: LinkedPlot[] }): JSX.Element | null {
  const navigate = useNavigate();
  if (linkedPlots.length === 0) return null;

  const transactions = linkedPlots.map(({ plot, site }) => ({
    id: plot.transaction_id as string,
    // A plot number alone is meaningless across sites; the site name is what
    // tells a developer which one they are looking at.
    propertyAddress: `${site.name} — Plot ${plot.plot_number}`,
    status: toOverviewStatus(plot.current_legal_status),
  }));

  return (
    <div className="mb-8">
      <ProfessionalOverviewPanel
        transactions={transactions}
        onTransactionClick={(transactionId) => {
          const match = linkedPlots.find(({ plot }) => plot.transaction_id === transactionId);
          if (match) navigate(`/builder/sites/${match.site.id}`);
        }}
      />
    </div>
  );
}

function SitesList({ sites }: { sites: DevelopmentSite[] }): JSX.Element {
  const linkedPlots = useLinkedPlots(sites);
  return (
    <div className="py-8">
      <PortfolioOverview linkedPlots={linkedPlots} />
      <CrossSiteBlockerStack linkedPlots={linkedPlots} />
      <div className="flex items-center justify-between">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          Your sites
        </h1>
        <Link
          to="/builder/sites/new"
          className="inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
        >
          + New site
        </Link>
      </div>
      <ul className="mt-6 space-y-3">
        {sites.map((site) => (
          <li key={site.id}>
            <Link
              to={`/builder/sites/${site.id}`}
              className="block rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[#0D9488]/40 hover:bg-[#0D9488]/5 dark:hover:border-[#0D9488]/40 dark:hover:bg-[#0D9488]/5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-[Fraunces] text-lg font-semibold text-[var(--text-main)]">
                    {site.name}
                  </h2>
                  <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
                    {site.address}, {site.postcode}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#84A98C]/20 px-3 py-1 font-[DM_Sans] text-xs font-medium text-[#5F8A68] dark:text-[#84A98C]">
                  {site.total_plots} plots · {site.status}
                </span>
              </div>
              {site.appointed_solicitor_firm && (
                <p className="mt-2 font-[DM_Sans] text-xs text-[var(--text-muted)]">
                  Solicitor: {site.appointed_solicitor_firm}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BuilderDashboardPage(): JSX.Element {
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const userName = supabaseUser?.user_metadata?.name as string | null ?? null;
  const { data: memberships, isLoading: membershipsLoading } = useMembershipsQuery(supabaseUser?.id);
  const devOrg = memberships?.find((m) => m.organisationType === 'developer');

  const [sites, setSites] = useState<DevelopmentSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const fetchSites = useCallback(async (): Promise<void> => {
    if (!devOrg) return;
    setSitesLoading(true);
    setHasError(false);
    try {
      const data = await sitesService.getByOrganisation(devOrg.organisationId);
      setSites(data);
    } catch {
      setHasError(true);
    } finally {
      setSitesLoading(false);
    }
  }, [devOrg?.organisationId]);

  useEffect(() => {
    if (devOrg) {
      fetchSites();
    }
  }, [devOrg?.organisationId, fetchSites]);

  const isLoading = membershipsLoading || (!!devOrg && sitesLoading && sites.length === 0);
  const state = deriveState(isLoading, hasError, sites);

  if (state === 'loading') return <LoadingSkeleton />;
  if (state === 'error') return <ErrorState onRetry={fetchSites} />;
  if (state === 'empty') return <BuilderEmptyPage userName={userName} />;

  // success / partial
  return <SitesList sites={sites} />;
}
