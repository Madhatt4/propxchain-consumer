// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Site detail page — hub for managing a single development site.
 * Shows site info, plot types, and plots (wave 1b).
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Users, Building2, ArrowRight, Calendar } from 'lucide-react';

import { sitesService, type DevelopmentSite } from '@/services/sites.service';
import { plotTypesService } from '@/services/plot-types.service';
import { plotsService } from '@/services/plots.service';
import SiteMetricsRow from '@/components/builder/SiteMetricsRow';
import SolicitorSection from '@/components/builder/SolicitorSection';
import { ConveyancerPanel } from '@/components/providers/ConveyancerPanel';
import { QuoteComparisonView } from '@/components/providers/QuoteComparisonView';
import { SearchesPanel } from '@/components/providers/SearchesPanel';
import { conveyancerQuoteService } from '@/services/conveyancerQuote.service';
import { searchOrderService } from '@/services/searchOrder.service';
import type { ConveyancerQuote } from '@/components/providers/types';
import type { SearchOrder } from '@/services/searchOrder.service';
import NextStepCard from '@/components/common/NextStepCard';

export default function SiteDetailPage(): JSX.Element {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<DevelopmentSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotTypeCount, setPlotTypeCount] = useState<number>(0);
  const [plotCount, setPlotCount] = useState<number>(0);
  const [isSolicitorOpen, setIsSolicitorOpen] = useState(false);
  const [isSolicitorEditing, setIsSolicitorEditing] = useState(false);
  const [quotes, setQuotes] = useState<ConveyancerQuote[]>([]);
  const [showConveyancerPanel, setShowConveyancerPanel] = useState(false);
  const [searchOrders, setSearchOrders] = useState<SearchOrder[]>([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchesComplete, setSearchesComplete] = useState(false);
  const [activeTxIds, setActiveTxIds] = useState<string[]>([]);

  const fetchSite = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await sitesService.getById(siteId);
      setSite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  const fetchCounts = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    try {
      const [types, plots] = await Promise.all([
        plotTypesService.getBySite(siteId),
        plotsService.countBySite(siteId),
      ]);
      setPlotTypeCount(types.length);
      setPlotCount(plots);
    } catch {
      // Non-critical — silently ignore count fetch errors
    }
  }, [siteId]);

  useEffect(() => {
    fetchSite();
    fetchCounts();
  }, [fetchSite, fetchCounts]);

  // F.4 — collect tx IDs across plots so the next-step stack can score them.
  // Capped to 5 cards so the page doesn't drown when a site has many active txs.
  useEffect(() => {
    if (!siteId) return;
    plotsService
      .getBySite(siteId)
      .then((plots) =>
        setActiveTxIds(
          plots
            .map((p) => p.transaction_id)
            .filter((id): id is string => Boolean(id))
            .slice(0, 5),
        ),
      )
      .catch(() => setActiveTxIds([]));
  }, [siteId]);

  useEffect(() => {
    if (site?.id) {
      conveyancerQuoteService
        .getQuotesForTransaction(`site-${site.id}`)
        .then(setQuotes)
        .catch(() => setQuotes([]));
    }
  }, [site?.id]);

  useEffect(() => {
    if (site?.id) {
      searchOrderService.getOrdersForTransaction(`site-${site.id}`)
        .then(setSearchOrders)
        .catch(() => setSearchOrders([]));
    }
  }, [site?.id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="py-12 text-center">
        <p className="font-[DM_Sans] text-base text-red-600 dark:text-red-400">
          {error || 'Site not found.'}
        </p>
        <Link
          to="/builder"
          className="mt-4 inline-flex items-center font-[DM_Sans] text-sm text-[#0D9488] hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to sites
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/builder"
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
            {site.name}
          </h1>
          <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            {site.address}, {site.postcode}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#84A98C]/20 px-3 py-1 font-[DM_Sans] text-xs font-medium text-[#5F8A68] dark:text-[#84A98C]">
          {site.status}
        </span>
      </div>

      {/* Info cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-[#0D9488]" />
            <div>
              <p className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">Location</p>
              <p className="font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
                {site.postcode}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[#0D9488]" />
            <div>
              <p className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">Total plots</p>
              <p className="font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
                {site.total_plots}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-[#0D9488]" />
            <div>
              <p className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">Solicitor</p>
              <p className="font-[DM_Sans] text-sm font-medium text-[var(--text-main)]">
                {site.appointed_solicitor_firm || 'Not appointed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* F.4 — Per-plot next-step stack. Compact variant; one card per active
          transaction in the site, capped at 5. Hidden when no plots have a tx. */}
      {activeTxIds.length > 0 && (
        <section className="mt-8">
          <h2 className="font-[Fraunces] text-lg font-semibold text-[var(--text-main)]">
            Active blockers
          </h2>
          <div className="mt-3 space-y-3">
            {activeTxIds.map((id) => (
              <NextStepCard key={id} txId={id} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {/* Solicitor section — collapsible */}
      <SolicitorSection
        site={site}
        isOpen={isSolicitorOpen}
        isEditing={isSolicitorEditing}
        onToggle={() => setIsSolicitorOpen((prev) => !prev)}
        onEdit={() => setIsSolicitorEditing(true)}
        onSaved={(firm, contact, email) => {
          setSite((prev) =>
            prev
              ? {
                  ...prev,
                  appointed_solicitor_firm: firm || null,
                  appointed_solicitor_contact: contact || null,
                  appointed_solicitor_email: email || null,
                }
              : prev,
          );
          setIsSolicitorEditing(false);
        }}
        onCancel={() => setIsSolicitorEditing(false)}
      />

      {/* Metrics row */}
      {siteId && (
        <div className="mt-6">
          <SiteMetricsRow siteId={siteId} />
        </div>
      )}

      {/* Searches Panel */}
      <div className="mt-6">
        {searchOrders.length > 0 || searchesComplete ? (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
            <h3 style={{ fontFamily: 'Fraunces, Georgia, serif' }} className="text-lg text-[var(--text-main)]">
              ✓ Searches Ordered
            </h3>
            {searchOrders.length > 0 ? (
              <div className="mt-3 space-y-2">
                {searchOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-main)]">{order.provider === 'tmgroup' ? 'tmGroup' : order.provider}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{order.searches.length} searches · {order.status}</p>
                    </div>
                    <p className="font-mono text-sm tabular-nums text-[var(--text-main)]">
                      £{(order.totalPence / 100).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Search order placed via tmGroup</p>
            )}
          </div>
        ) : showSearchPanel && site ? (
          <SearchesPanel
            postcode={site.postcode || ''}
            transactionId={`site-${site.id}`}
            transactionType="new-build"
            partyName=""
            partyEmail=""
            propertyAddress={`${site.address || ''}, ${site.postcode || ''}`}
            orderedBy="seller"
            onOrderComplete={() => {
              setShowSearchPanel(false);
              setSearchesComplete(true);
              if (site?.id) {
                void searchOrderService.getOrdersForTransaction(`site-${site.id}`).then(setSearchOrders);
              }
            }}
          />
        ) : (
          <button
            onClick={() => setShowSearchPanel(true)}
            className="w-full rounded-xl border-2 border-dashed border-[var(--border-color)] py-8 text-center text-sm text-[var(--text-secondary)] transition-colors hover:border-teal-500 hover:text-teal-600 dark:hover:border-teal-400 dark:hover:text-teal-400"
          >
            + Order Property Searches
          </button>
        )}
      </div>

      {/* Conveyancer Panel */}
      <div className="mt-6">
        {quotes.length > 0 ? (
          <QuoteComparisonView
            quotes={quotes}
            onAccepted={() => {
              if (site?.id) {
                void conveyancerQuoteService
                  .getQuotesForTransaction(`site-${site.id}`)
                  .then(setQuotes);
              }
            }}
          />
        ) : showConveyancerPanel ? (
          <ConveyancerPanel
            postcode={site.postcode || ''}
            transactionId={`site-${site.id}`}
            transactionType="new-build"
            partyName=""
            partyEmail=""
            propertyAddress={`${site.address || ''}, ${site.postcode || ''}`}
            onQuotesRequested={() => {
              setShowConveyancerPanel(false);
              if (site?.id) {
                void conveyancerQuoteService
                  .getQuotesForTransaction(`site-${site.id}`)
                  .then(setQuotes);
              }
            }}
          />
        ) : (
          <button
            onClick={() => setShowConveyancerPanel(true)}
            className="w-full rounded-xl border-2 border-dashed border-[var(--border-color)] py-8 text-center text-sm text-[var(--text-secondary)] transition-colors hover:border-teal-500 hover:text-teal-600 dark:hover:border-teal-400 dark:hover:text-teal-400"
          >
            + Appoint a Conveyancer
          </button>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          to={`/builder/sites/${siteId}/pipeline`}
          className="inline-flex items-center gap-1 font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:text-[#0F766E]"
        >
          View pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to={`/builder/sites/${siteId}/milestones`}
          className="inline-flex items-center gap-1 font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:text-[#0F766E]"
        >
          <Calendar className="h-4 w-4" />
          Milestones
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Plot types */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-[Fraunces] text-xl font-semibold text-[var(--text-main)]">
            Plot types
            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--bg-section)] px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]">
              {plotTypeCount}
            </span>
          </h2>
          <Link
            to={`/builder/sites/${siteId}/plot-types`}
            className="inline-flex min-h-10 items-center gap-1 font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:text-[#0F766E]"
          >
            Manage plot types
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Plots */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-[Fraunces] text-xl font-semibold text-[var(--text-main)]">
            Plots
            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--bg-section)] px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]">
              {plotCount}
            </span>
          </h2>
          <Link
            to={`/builder/sites/${siteId}/plots`}
            className="inline-flex min-h-10 items-center gap-1 font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:text-[#0F766E]"
          >
            Manage plots
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
