import { useEffect, useMemo, useState } from 'react';
import { ProviderPanel } from './ProviderPanel';
import { QuoteRequestBar } from './QuoteRequestBar';
import { ConveyancerSearch } from './ConveyancerSearch';
import { useProviderData } from '../../hooks/useProviderData';
import { useProviderPanel } from '../../hooks/useProviderPanel';
import { conveyancerQuoteService } from '../../services/conveyancerQuote.service';
import { lenderPanelService, decorateProviders, MIN_PANEL_MATCHES } from '../../services/lenderPanel.service';
import {
  searchCompatibilityService,
  decorateSearchCompatibility,
  MIN_COMPATIBLE_MATCHES,
  type SearchDeclaration,
} from '../../services/searchCompatibility.service';
import { LenderPrompt, LenderFilterBar, LenderFallbackBanner } from './LenderPanelControls';
import { SearchCompatibilityFilterBar, SearchCompatibilityFallbackBanner } from './SearchCompatibilityControls';
import { logger } from '../../utils/logger';

interface ConveyancerPanelProps {
  postcode: string;
  transactionId: string;
  transactionType: 'sale' | 'purchase' | 'new-build';
  partyName: string;
  partyEmail: string;
  propertyAddress: string;
  titleNumber?: string;
  tenure?: string;
  onQuotesRequested?: () => void;
  maxSelections?: number;
  /** Buyer's mortgage lender (buyer-5 only). Enables panel filtering. */
  lenderName?: string;
  /** Buyer journey only: invoked when the inline prompt captures a lender.
   *  Presence of this prop is what renders the prompt. */
  onLenderCaptured?: (lender: string) => void;
  /** ISO date the transaction's ORIGINAL pack search was issued. Null means
   *  known to have no pack searches; undefined/absent means the call site
   *  doesn't wire this up yet — either way, search-compatibility badges and
   *  filtering are skipped. */
  originalSearchIssuedAt?: string | null;
}

function ConveyancerCallout(): React.ReactElement {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 dark:border-teal-400/20 dark:bg-teal-400/5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h4 className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
            Select up to 3 conveyancers to request quotes from
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            Each conveyancer will receive your transaction details and respond
            with a tailored quote. Compare fees, timescales, and ratings before
            you decide — no commitment required.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ConveyancerPanel({
  postcode,
  transactionId,
  transactionType,
  partyName,
  partyEmail,
  propertyAddress,
  titleNumber,
  tenure,
  onQuotesRequested,
  maxSelections = 3,
  lenderName,
  onLenderCaptured,
  originalSearchIssuedAt,
}: ConveyancerPanelProps): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // activeLender lets the inline prompt take effect immediately without
  // waiting for the parent (TransactionFlowPage) to re-render.
  const [activeLender, setActiveLender] = useState(lenderName ?? '');
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // null = lookup pending or lender unknown → no filtering applied.
  const [panelIds, setPanelIds] = useState<string[] | null>(null);
  const [showAllCompatibility, setShowAllCompatibility] = useState(false);
  // null = fetch pending or feature inactive → no compatibility badges shown.
  const [declarations, setDeclarations] = useState<SearchDeclaration[] | null>(null);

  useEffect(() => {
    setActiveLender(lenderName ?? '');
  }, [lenderName]);

  useEffect(() => {
    if (!activeLender) {
      setPanelIds(null);
      return;
    }
    // Pending state on every new lender — gates the provider fetch below so
    // exactly one (already-filtered) fetch fires once the lookup settles.
    setPanelIds(null);
    let cancelled = false;
    lenderPanelService
      .getPanelConveyancerIds(activeLender)
      .then((ids) => { if (!cancelled) setPanelIds(ids); })
      .catch((err: unknown) => {
        logger.warn('[lenderPanel] panel lookup failed', err);
        // Failed lookup degrades to the fallback path: unfiltered list + banner.
        if (!cancelled) setPanelIds([]);
      });
    return () => { cancelled = true; };
  }, [activeLender]);

  useEffect(() => {
    if (!originalSearchIssuedAt) {
      setDeclarations(null);
      return;
    }
    let cancelled = false;
    searchCompatibilityService
      .getDeclarations()
      .then((rows) => { if (!cancelled) setDeclarations(rows); })
      .catch((err: unknown) => {
        logger.warn('[searchCompatibility] declarations lookup failed', err);
        // Failed lookup degrades the same way lender-panel does: no badges,
        // no filtering — never a silent "accepts" from missing data.
        if (!cancelled) setDeclarations([]);
      });
    return () => { cancelled = true; };
  }, [originalSearchIssuedAt]);

  const panelLookupPending = activeLender !== '' && panelIds === null;
  const filterActive =
    activeLender !== '' && panelIds !== null && panelIds.length >= MIN_PANEL_MATCHES && !showAll;
  const fallbackActive =
    activeLender !== '' && panelIds !== null && panelIds.length < MIN_PANEL_MATCHES;
  const filterIds = useMemo(
    () => (filterActive && panelIds ? panelIds : undefined),
    [filterActive, panelIds],
  );

  const { providers, isLoading, error, refetch } = useProviderData('conveyancer', {
    postcode,
    sortBy: 'distance',
    filterIds,
    enabled: !panelLookupPending,
  });
  const { compareIds, toggleCompare, clearCompare } = useProviderPanel();

  // Badge gating: an empty panel set (zero-row lender or lookup outage) means
  // we hold no data — suppress badges entirely rather than stamping every
  // firm with a false amber "Not on {lender}'s panel" right under a banner
  // saying we hold no data. Filtering logic above is untouched by this.
  const badgePanelIds = panelIds && panelIds.length > 0 ? panelIds : null;

  const displayProviders =
    activeLender !== '' && badgePanelIds !== null
      ? decorateProviders(providers, badgePanelIds, activeLender)
      : providers;

  const compatibilityActive = Boolean(originalSearchIssuedAt) && declarations !== null;

  const compatibilityDecorated = useMemo(
    () =>
      compatibilityActive
        ? decorateSearchCompatibility(displayProviders, declarations ?? [], {
            originalSearchIssuedAt: originalSearchIssuedAt ?? null,
            now: new Date(),
          })
        : displayProviders,
    [compatibilityActive, displayProviders, declarations, originalSearchIssuedAt],
  );

  const acceptingCount = compatibilityDecorated.filter((p) => p.searchCompatibility === 'accepts').length;
  const compatibilityFilterActive =
    compatibilityActive && acceptingCount >= MIN_COMPATIBLE_MATCHES && !showAllCompatibility;
  const compatibilityFallbackActive = compatibilityActive && acceptingCount < MIN_COMPATIBLE_MATCHES;

  const finalProviders = compatibilityFilterActive
    ? compatibilityDecorated.filter((p) => p.searchCompatibility === 'accepts')
    : compatibilityDecorated;

  function handleToggleSelect(providerId: string): void {
    setSelectedIds((prev) => {
      if (prev.includes(providerId)) {
        return prev.filter((id) => id !== providerId);
      }
      if (prev.length >= maxSelections) return prev;
      return [...prev, providerId];
    });
  }

  function handleLenderCaptured(lender: string): void {
    setActiveLender(lender);
    setShowAll(false);
    onLenderCaptured?.(lender);
  }

  async function handleRequestQuotes(): Promise<void> {
    if (selectedIds.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await conveyancerQuoteService.requestQuotes({
        transactionId,
        conveyancerIds: selectedIds,
        transactionType,
        partyName,
        partyEmail,
        propertyAddress,
        titleNumber,
        tenure,
      });
      if (!result.success) {
        console.warn('Quote request failed (continuing anyway):', result.error);
      }
    } catch (err) {
      console.warn('Quote request error (continuing anyway):', err);
    } finally {
      setIsSubmitting(false);
      onQuotesRequested?.();
    }
  }

  return (
    <>
      <ProviderPanel
        title="Conveyancer / Solicitor"
        subtitle="Choose a vetted, regulated conveyancer for your transaction"
        stageNumber={5}
        layout="rows"
        badge="Vetted Panel"
        description="Select from our curated panel of regulated conveyancers and solicitors. All firms have been vetted and agreed to work through the PropXchain platform, giving you full visibility of progress."
        providers={finalProviders}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onSelect={handleToggleSelect}
        selectedId={selectedIds[selectedIds.length - 1]}
        onContinue={handleToggleSelect}
        callout={
          <div className="space-y-3">
            {onLenderCaptured && !activeLender && !promptDismissed && (
              <LenderPrompt
                onLenderCaptured={handleLenderCaptured}
                onDismiss={() => setPromptDismissed(true)}
              />
            )}
            {activeLender !== '' && panelIds !== null && panelIds.length >= MIN_PANEL_MATCHES && (
              <LenderFilterBar
                lenderName={activeLender}
                matchCount={panelIds.length}
                shownCount={displayProviders.length}
                showAll={showAll}
                onToggleShowAll={() => setShowAll((v) => !v)}
              />
            )}
            {fallbackActive && <LenderFallbackBanner lenderName={activeLender} />}
            {compatibilityActive && acceptingCount >= MIN_COMPATIBLE_MATCHES && (
              <SearchCompatibilityFilterBar
                matchCount={acceptingCount}
                shownCount={finalProviders.length}
                showAll={showAllCompatibility}
                onToggleShowAll={() => setShowAllCompatibility((v) => !v)}
              />
            )}
            {compatibilityFallbackActive && <SearchCompatibilityFallbackBanner />}
            <ConveyancerCallout />
          </div>
        }
        priceLabel="+ disbursements"
        compareIds={compareIds}
        onCompareToggle={toggleCompare}
        onCompareClear={clearCompare}
      />
      <ConveyancerSearch
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        maxSelections={maxSelections}
        curatedIds={finalProviders.map((p) => p.id)}
        panelIds={activeLender !== '' ? badgePanelIds : null}
        lenderName={activeLender || undefined}
      />
      <QuoteRequestBar
        selectedCount={selectedIds.length}
        maxSelections={maxSelections}
        onRequestQuotes={handleRequestQuotes}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
