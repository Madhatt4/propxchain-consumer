// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useRef, useState, useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { useAuthStore } from '../stores/authStore';
// Note: React.ReactElement used in BuyerSideStagePlaceholder return type below
// is provided via the ReactElement named import.
import { useParams } from 'react-router-dom';
import { useTransactionFlow } from '../hooks/useTransactionFlow';
import { useMoveNarrator } from '../hooks/useMoveNarrator';
import { TopBar } from '../components/transaction/flow/TopBar';
import { StageCard } from '../components/transaction/flow/StageCard';
import { StageTabs, BUYER_SIDE_TAB_ID, SALES_PACK_TAB_ID } from '../components/transaction/flow/StageTabs';
import { OtherPartyProgressCard } from '../components/transaction/flow/OtherPartyProgressCard';
import { CostFooterMobile } from '../components/transaction/flow/CostFooterMobile';
import { PropertyListingCard } from '../components/transaction/flow/PropertyListingCard';
import { StageHelpPanel } from '../components/transaction/flow/StageHelpPanel';
import { OnboardingBanner } from '../components/transaction/flow/OnboardingBanner';
import { ListPropertyStage } from '../components/transaction/flow/stages/ListPropertyStage';
import { PropertyInfoStage } from '../components/transaction/flow/stages/PropertyInfoStage';
import { PropertyMatchedStage } from '../components/transaction/flow/stages/PropertyMatchedStage';
import { MortgageFundingStage } from '../components/transaction/flow/stages/MortgageFundingStage';
import { ReviewSellerPackStage } from '../components/transaction/flow/stages/ReviewSellerPackStage';
import { ContractExchangeStage } from '../components/transaction/flow/stages/ContractExchangeStage';
import { CompletionStage } from '../components/transaction/flow/stages/CompletionStage';
import { SearchesPanel } from '../components/providers/SearchesPanel';
import { ConveyancerQuotesStage } from '../components/transaction/flow/stages/ConveyancerQuotesStage';
import { SurveyPanel } from '../components/providers/SurveyPanel';
import { SurveyReferralStatusCard } from '../components/providers/SurveyReferralStatusCard';
import { BuyerInviteCard } from '../components/transaction/flow/BuyerInviteCard';
import NextStepCard from '../components/common/NextStepCard';
import { StallLine } from '../components/transaction/flow/StallLine';
import { MandateBanners } from '../components/transaction/flow/MandateBanners';
import { TOPBAR_ACTION_SLOT_ID } from '../components/navigation/AppTopBar';
import { flashNextStepTarget } from '../utils/nextStepHighlight';
import MoveNarratorBanner from '../components/transaction/MoveNarratorBanner';
import { SalesPackTab } from '../components/transaction/tabs/SalesPackTab';
import { usePackReadiness } from '../hooks/usePackReadiness';
import MoveNarratorPreviewButton from '../components/transaction/MoveNarratorPreviewButton';
import { useMoveNarratorNotifications } from '../hooks/useMoveNarratorNotifications';
import { useSubscription } from '../hooks/useSubscription';
import RestorePill from '../components/common/RestorePill';
import { ConfirmEditDialog } from '../components/common/ConfirmEditDialog';
import { icpService } from '../services/icp.service';
import { partyRoleService } from '../services/partyRole.service';
import { declareBuyerPack } from '../services/buyerPack.service';
import { logger } from '../utils/logger';
import { useDismiss } from '../hooks/useDismiss';
import { TransactionTabs } from '../components/transaction/tabs/TransactionTabs';
import { useProviderFlow } from '../hooks/useProviderFlow';
import {
  searchProviders,
  conveyancerProviders,
  surveyProviders,
} from '../components/providers/providerData';
import type { Provider } from '../components/providers/types';
import type { ProviderCategory } from '../services/providerDataSource';

const ALL_PROVIDERS: Provider[] = [
  ...searchProviders,
  ...conveyancerProviders,
  ...surveyProviders,
];

const STAGE_CATEGORY_MAP: Record<string, ProviderCategory> = {
  'seller-2': 'searches',
  'seller-5': 'conveyancer',
  'buyer-5': 'conveyancer',
  'buyer-3': 'survey',
};
import { SiteContextBanner } from '../components/buyer/SiteContextBanner';
import { fireConfetti } from '../utils/confetti';
import { syncListingFromChain } from '../utils/rightmoveStorage';
import { resolvePropertyPostcode } from '../utils/propertyFields';
import type { RightmovePropertyListing } from '../types/rightmove.types';
import type { Tenure } from '../types/listing.types';
import type { StructuredAddress } from '../services/pafAddress';
import type { StageConfig, JourneyRole } from '../types/stage.types';
import { resolveNextStepDestination } from '../utils/nextStepDestination';
import type { ServiceProvider, ProviderSelection } from '../types/provider.types';

/** Stage IDs that are not rendered as stage cards (displayed as sidebar components instead) */
const HIDDEN_STAGE_IDS = new Set(['seller-4']);

/** Stage IDs whose content components understand the `isEditing` prop and
 *  re-render their input UI with current values pre-filled. The Edit button
 *  is only shown for completed stages in this set — others get no edit
 *  affordance until their component is updated.
 *
 *  Tier A — provider stages: edits trigger a ConfirmEditDialog because
 *  swapping a provider mid-transaction cancels the existing quote request.
 *  Tier B (TA6/TA10/TA7 forms) and Tier C (Mortgage/Funding) are wired —
 *  funding lives in the Buyer Pack so the edit re-opens pre-filled from the server.
 *  Exchange/Completion stay out: on-chain-final, nothing to safely re-edit. */
const EDITABLE_STAGE_IDS = new Set([
  'seller-1', // List Property
  // seller-2 (Searches) intentionally omitted: the stage-card pencil
  // doesn't re-render SearchesPanel content (browser-harness confirmed
  // 2026-05-21). Edit affordance moved into the panel's OrderConfirmation
  // card as a "Re-order searches" link, which calls onClearProvider and
  // resets local panel state — works reliably regardless of why the
  // pencil flow renders empty.
  'seller-3', // TA6/TA10/TA7 forms
  'buyer-2',  // Mortgage / Funding (the Buyer Pack declaration)
  'buyer-3',  // Survey
  'seller-5', // Conveyancer (seller-side)
  'buyer-5',  // Conveyancer (buyer-side)
]);

/** Subset of EDITABLE_STAGE_IDS that need a ConfirmEditDialog before saving
 *  the edit, because the change has real-world consequences (cancelling a
 *  provider's quote request, etc.). */
const PROVIDER_EDIT_STAGE_IDS = new Set(['buyer-3', 'seller-5', 'buyer-5']);

/** Non-interactive card showing where a buyer-only stage fits in the seller
 *  timeline. Avoids the previous "Stage 3 → Stage 5" jump in the seller view
 *  which read as a missing stage. */
function BuyerSideStagePlaceholder({ stageNumber }: { stageNumber: number }): ReactElement {
  return (
    <div
      className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-4 py-3"
      aria-label={`Stage ${stageNumber} is handled by the buyer`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 font-[DM_Sans] text-sm font-semibold text-gray-500 dark:text-gray-400">
            {stageNumber}
          </span>
          <div>
            <p className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Stage {stageNumber}
            </p>
            <p className="font-[DM_Sans] text-sm font-semibold text-gray-700 dark:text-gray-200">
              Mortgage &amp; funding
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-800 px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-gray-600 dark:text-gray-300">
          Buyer side
        </span>
      </div>
      <p className="mt-1.5 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
        The buyer arranges their mortgage / funding on their side. Nothing for you to do here.
      </p>
    </div>
  );
}

interface StageComponentProps {
  stage: StageConfig;
  onSelectProvider?: (stageId: string, provider: ServiceProvider) => void;
  /** Clear the stage's provider selection + completion. Used by panels that
   *  expose an in-card "Re-order" affordance (currently SearchesPanel at
   *  seller-2). */
  onClearProvider?: (stageId: string) => void;
  onRateProvider?: (stageId: string, rating: number, comment?: string) => void;
  onComplete?: (stageId: string) => void;
  providerSelection?: ProviderSelection;
  journeyRole?: JourneyRole;
  /** The viewer's ACTUAL role on the transaction (not the journey being
   *  viewed) — the Seller/Buyer toggle lets a buyer browse seller stages,
   *  and seller-only forms must render read-only for them. */
  viewerRole?: JourneyRole;
  inviteCode?: string;
  transactionId?: string;
  onListingImported?: (listing: RightmovePropertyListing) => void;
  otherPartyStages?: StageConfig[];
  postcode?: string;
  turboMode?: boolean;
  onTurboToggle?: (value: boolean) => void;
  toServiceProvider?: (provider: Provider, category: ProviderCategory) => ServiceProvider;
  /** Party info threaded into provider panels (SearchesPanel / ConveyancerPanel)
   *  so search + conveyancer orders carry the real requester identity rather
   *  than empty strings. */
  partyName?: string;
  partyEmail?: string;
  propertyAddress?: string;
  /** Structured address fields from the listing. Supplier orders need the
   *  parts separately — see SearchesPanel's addressParts. */
  addressParts?: StructuredAddress;
  /** Listing/agreed price — prefills the survey referral dialog. */
  propertyValue?: number;
  /** UPRN — passed on survey referrals for exact property matching. */
  uprn?: string;
  /** Listing tenure — passed through to PropertyInfoStage so freehold sales
   *  don't get offered the TA7 (Leasehold) form. */
  tenure?: Tenure | null;
  /** Stage was completed but the user clicked Edit to re-open it. The stage
   *  component should render its input UI again with current values
   *  pre-filled. Stage components that don't yet support editing simply
   *  ignore this prop. */
  isEditing?: boolean;
  /** Callback for the Cancel button in edit mode — closes edit mode without
   *  persisting changes. */
  onCancelEdit?: (stageId: string) => void;
  /** Called by edit-aware stage components after a successful save so the
   *  page-level invalidationKey bumps and downstream cards (NextStepCard)
   *  refetch on-chain state. */
  onAfterEdit?: () => void;
}

function renderStageContent(stageId: string, props: StageComponentProps): ReactElement | null {
  const { stage, onSelectProvider, onComplete, providerSelection, postcode, toServiceProvider: bridge } = props;

  // Provider marketplace stages — use new panels
  const handleProviderSelect = (_providerId: string): void => {
    // Selection state managed by ProviderPanel internally
  };

  const handleProviderContinue = (providerId: string): void => {
    if (!bridge || !onSelectProvider) return;
    const provider = ALL_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;
    const category = STAGE_CATEGORY_MAP[stageId];
    if (category) {
      onSelectProvider(stageId, bridge(provider, category));
    }
  };

  const selectedProviderId = providerSelection?.providerId;

  // If provider already selected + completed, show compact status — UNLESS
  // the user clicked Edit. In edit mode the panel re-opens so a new order
  // can be placed; the existing one persists in Supabase as a historical
  // record (audit-trail-friendly, conveyancer can reconcile).
  if (providerSelection?.completedAt && stage.hasProviderMarketplace && !props.isEditing) {
    const completedBox = (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
        <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Provider selected
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Stage completed
          </p>
        </div>
      </div>
    );
    // Survey stage: the referral runs off-platform (Optimus quote → invoice
    // → report direct to the buyer), so show what was sent and what happens
    // next instead of the generic box. Falls back to it when no referral row
    // exists (legacy selections, fetch failure).
    if (stageId === 'buyer-3' && props.transactionId) {
      return (
        <SurveyReferralStatusCard
          transactionId={props.transactionId}
          fallback={completedBox}
        />
      );
    }
    return completedBox;
  }

  // In edit mode for a provider stage, the panel's completion callback
  // shouldn't re-fire the parent's onComplete (the stage is already done).
  // Instead: log a `provider_changed` audit event capturing the swap, bump
  // the invalidation key so NextStepCard refetches, then
  // close edit mode.
  const handleProviderEditComplete = (): void => {
    if (!props.transactionId) return;
    void icpService.ledgerManager
      ?.logEvent(
        props.transactionId,
        'provider_changed',
        `${stageId}: provider updated in edit mode`,
        [JSON.stringify({ stageId, previousProviderId: providerSelection?.providerId ?? null })],
      )
      .catch((err: unknown) => logger.warn('[providerEdit] logEvent failed', err));
    props.onAfterEdit?.();
    props.onCancelEdit?.(stageId);
  };

  const onPanelDone = props.isEditing
    ? handleProviderEditComplete
    : (): void => onComplete?.(stageId);

  switch (stageId) {
    case 'seller-1':
      return (
        <ListPropertyStage
          {...props}
          isEditing={props.isEditing}
          onCancelEdit={props.onCancelEdit ? () => props.onCancelEdit?.(stageId) : undefined}
          onAfterEdit={props.onAfterEdit}
        />
      );
    case 'seller-2':
      return (
        <SearchesPanel
          postcode={postcode || ''}
          transactionId={props.transactionId || ''}
          transactionType="sale"
          partyName={props.partyName ?? ''}
          partyEmail={props.partyEmail ?? ''}
          propertyAddress={props.propertyAddress ?? ''}
          addressParts={props.addressParts}
          uprn={props.uprn}
          orderedBy="seller"
          onOrderComplete={onPanelDone}
          onProviderSelected={(provider) => props.onSelectProvider?.(stageId, provider)}
          onEdit={() => props.onClearProvider?.(stageId)}
        />
      );
    case 'seller-3':
      return (
        <PropertyInfoStage
          {...props}
          isEditing={props.isEditing}
          onCancelEdit={props.onCancelEdit ? () => props.onCancelEdit?.(stageId) : undefined}
          onAfterEdit={props.onAfterEdit}
          viewerIsBuyer={props.viewerRole === 'buyer'}
        />
      );
    case 'seller-5':
    case 'buyer-5': {
      // Lender-panel filtering is buyer-only: sellers have no lender, and a
      // cash buyer's funding choice suppresses the prompt entirely.
      // The buyer's lender lives in the Buyer Pack now (spec 2026-09-05); the
      // stage reads it itself and a picked lender is declared back into the pack.
      const canCaptureLender = stageId === 'buyer-5' && !!props.transactionId;
      return (
        <ConveyancerQuotesStage
          postcode={postcode || ''}
          transactionId={props.transactionId || ''}
          partyName={props.partyName ?? ''}
          partyEmail={props.partyEmail ?? ''}
          propertyAddress={props.propertyAddress ?? ''}
          onQuotesRequested={onPanelDone}
          readBuyerLender={stageId === 'buyer-5'}
          onLenderCaptured={
            canCaptureLender
              ? (lender): void => { void declareBuyerPack(props.transactionId as string, { lenderName: lender }).catch((err: unknown) => logger.warn('[funding] lender capture failed', err)); }
              : undefined
          }
        />
      );
    }
    case 'seller-6': return <ContractExchangeStage {...props} journeyRole="seller" />;
    case 'seller-7': return <CompletionStage {...props} journeyRole="seller" />;
    case 'buyer-7': return <CompletionStage {...props} journeyRole="buyer" />;
    case 'buyer-1': return <PropertyMatchedStage {...props} />;
    case 'buyer-2':
      return (
        <MortgageFundingStage
          {...props}
          isEditing={props.isEditing}
          onCancelEdit={props.onCancelEdit ? () => props.onCancelEdit?.(stageId) : undefined}
          onAfterEdit={props.onAfterEdit}
        />
      );
    case 'buyer-3':
      return (
        <SurveyPanel
          onSelect={handleProviderSelect}
          selectedId={selectedProviderId}
          onContinue={(providerId) => {
            // In edit mode: still propagate the new provider via the standard
            // selectProvider path (it persists + logs `provider_selected`),
            // then run the edit-completion housekeeping so invalidationKey
            // bumps and edit mode closes. Outside edit mode this falls
            // through to handleProviderContinue + onComplete via the panel.
            handleProviderContinue(providerId);
            if (props.isEditing) handleProviderEditComplete();
          }}
          onSkip={onPanelDone}
          postcode={postcode}
          transactionId={props.transactionId}
          partyName={props.partyName}
          partyEmail={props.partyEmail}
          propertyAddress={props.propertyAddress}
          propertyValue={props.propertyValue}
          uprn={props.uprn}
        />
      );
    case 'buyer-4': return <ReviewSellerPackStage {...props} />;
    case 'buyer-6': return <ContractExchangeStage {...props} journeyRole="buyer" />;
    default: return null;
  }
}

function LoadingState(): ReactElement {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-[#060b18]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Loading transaction...</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-[#060b18]">
      <div className="text-center max-w-sm">
        <p className="text-red-500 dark:text-red-400 font-medium mb-2">Failed to load transaction</p>
        <p className="text-slate-500 text-sm mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function TransactionFlowPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const stageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [propertyListing, setPropertyListing] = useState<RightmovePropertyListing | null>(null);
  const [helpStageId, setHelpStageId] = useState<string | null>(null);
  // Progress dashboards (phase bar, checklist, searches tracking) collapse by
  // default so an anxious seller meets the next action first, not 4 panels.
  // When user clicks Edit on a provider stage, we gate entry into edit mode
  // behind a confirm dialog because the swap has real-world consequences
  // (cancels the existing quote request). null = no dialog, otherwise the
  // stage id awaiting confirmation.
  const [confirmingProviderEdit, setConfirmingProviderEdit] = useState<string | null>(null);

  // Per-tx dismiss state for cards the user can hide. Each one persists in
  // localStorage and pairs with a small restore pill rendered in place.
  const inviteDismiss = useDismiss(`buyerInvite:${id}`);

  // A deal's creator has no off-chain party row unless something trusted
  // writes it (monorepo runbook 2026-09-02-transaction-party-roles-not-recorded),
  // and document sharing, search visibility and ID & AML all read that row.
  // Ask once per visit when this viewer has none — also the backfill for
  // deals created before that writer existed.
  useEffect(() => {
    if (!id) return;
    void partyRoleService.ensureMyRoleFromChain(id);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // Hydrate from chain (localStorage-first, on-chain fallback) so the listing —
    // and the postcode / address / title it carries — survives across devices and
    // reaches the buyer, who never had the seller's localStorage copy. The listing
    // JSON is the authoritative store for these details; the transaction record's
    // own postcode/address fields are only set at creation and never re-synced.
    void syncListingFromChain(id).then((listing) => {
      if (!cancelled && listing) setPropertyListing(listing);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Current user's name / email for stamping provider orders + TopBar role label.
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const storeProfile = useAuthStore((s) => s.userProfile);
  const currentUserName =
    storeProfile?.name
    || (supabaseUser?.user_metadata?.name as string | undefined)
    || supabaseUser?.email?.split('@')[0]
    || 'User';
  const currentUserEmail = supabaseUser?.email ?? '';

  const {
    transaction,
    userRole,
    stages,
    otherPartyStages,
    activeJourney,
    providerSelections,
    selectProvider,
    clearProvider,
    rateProvider,
    completeStage: rawCompleteStage,
    totalCostPence,
    propxchainFeePence,
    editingStageIds,
    setStageEditing,
    isLoading,
    error,
    invalidationKey,
    bumpInvalidationKey,
  } = useTransactionFlow(id);

  const { turboMode, setTurboMode, toServiceProvider } = useProviderFlow(
    transaction?.postcode,
  );

  // Move Narrator (premium push-on-blocker-change). Detection is gated on
  // premium + a genuine change inside the hook; it re-checks whenever the
  // invalidation key bumps (same trigger that refetches NextStepCard).
  useMoveNarrator({
    txId: id,
    role: userRole,
    propertyAddress:
      transaction?.propertyAddress || propertyListing?.address || 'Unknown property',
    refreshKey: invalidationKey,
  });

  // In the premium view the AI card supersedes the NextStepCard (they say the
  // same thing). Show the AI card when premium and one has been delivered for
  // this transaction; otherwise fall back to the NextStepCard so a premium user
  // is never left without next-step guidance.
  const { isPremium } = useSubscription();
  const { notifications: aiNotifs } = useMoveNarratorNotifications();
  const hasAiCard = isPremium && aiNotifs.some((n) => n.txId === id);

  const completeStage = (stageId: string): void => {
    const el = stageRefs.current.get(stageId);
    if (el) {
      const rect = el.getBoundingClientRect();
      fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    rawCompleteStage(stageId);
  };

  // Filter out hidden stages (seller-4 Buyer Progress is a sidebar card)
  // Must be above early returns to satisfy React hook rules
  const visibleStages = useMemo(
    () => stages.filter((s) => !HIDDEN_STAGE_IDS.has(s.id)),
    [stages],
  );

  // Horizontal stage tabs: one stage is selected at a time and renders its
  // detail card below the tab row. null = "no explicit choice yet" — resolve
  // to the first active stage, else the first stage. Reset on role toggle.
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);

  useEffect(() => {
    setActiveStageId(null);
    setDetailOpen(true);
  }, [activeJourney]);

  const resolvedStageId = useMemo(() => {
    if (activeStageId === SALES_PACK_TAB_ID) return activeStageId;
    if (activeStageId === BUYER_SIDE_TAB_ID && activeJourney === 'seller') return activeStageId;
    if (activeStageId && visibleStages.some((s) => s.id === activeStageId)) return activeStageId;
    return (
      visibleStages.find((s) => s.status === 'active')?.id ?? visibleStages[0]?.id ?? null
    );
  }, [activeStageId, visibleStages, activeJourney]);

  // Stage 0 badge — "6 of 9" while assembling, "Complete" when done. A
  // placeholder keeps the tab present pre-load so the stage row never shifts.
  const { readiness: packReadiness } = usePackReadiness(id);
  const salesPackSummary = packReadiness
    ? packReadiness.done === packReadiness.total
      ? 'Complete'
      : `${packReadiness.done} of ${packReadiness.total}`
    : '…';

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const inviteCode = transaction?.inviteCode ?? null;
  // Prefer the canister's stored address; fall back to the imported listing
  // (Rightmove / Purplebricks) when the transaction record hasn't captured
  // it yet — otherwise the topbar reads "Unknown property" while the listing
  // card on the same screen happily shows the address.
  const propertyAddress =
    transaction?.propertyAddress
    || propertyListing?.address
    || 'Unknown property';
  // Falsy-aware resolution — see resolvePropertyPostcode for why `||` not `??`.
  const postcode = resolvePropertyPostcode(transaction?.postcode, propertyListing?.postcode);

  const isStage1Done = stages.some(s => s.id === 'seller-1' && s.status === 'completed');

  // Site context fields — will be populated once transaction metadata includes developer platform data.
  // For now, read from the raw transaction object (fields may not exist yet).
  const txRecord = transaction as Record<string, unknown> | null;
  const siteId = typeof txRecord?.site_id === 'string' ? txRecord.site_id : undefined;
  const siteName = typeof txRecord?.site_name === 'string' ? txRecord.site_name : undefined;
  const plotId = typeof txRecord?.plot_id === 'string' ? txRecord.plot_id : undefined;
  const uprn = typeof txRecord?.uprn === 'string' ? txRecord.uprn : undefined;

  const activeStage = visibleStages.find((s) => s.id === resolvedStageId) ?? null;

  const selectStage = (stageId: string): void => {
    setActiveStageId(stageId);
    setDetailOpen(true);
  };

  /**
   * Send the user to the stage where a next-step action actually happens.
   *
   * The mapping lives in utils/nextStepDestination so every action can be
   * tested against both journeys without mounting this page. Resolved here
   * rather than inside NextStepCard because only this page knows the journey
   * role and owns stage selection and the scroll refs.
   *
   * Previously this fell back to `setDetailOpen(true)` for anything it could
   * not map — and detailOpen already defaults to true, so those clicks did
   * nothing whatsoever. Four of the six actions were dead for a buyer. The
   * resolver now guarantees a destination whenever any stage exists.
   */
  const handleNextStepAction = (action: string): void => {
    const journey: JourneyRole = activeJourney === 'seller' ? 'seller' : 'buyer';
    const destination = resolveNextStepDestination(action, journey, visibleStages);
    if (!destination) return;

    selectStage(destination.stageId);
    // Let the stage mount before scrolling to it.
    const target = destination.stageId;
    requestAnimationFrame(() => {
      const el = stageRefs.current.get(target);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Ring it once the scroll has settled, so the marker is not already
      // fading by the time the user's eye arrives.
      window.setTimeout(() => flashNextStepTarget(el), 400);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#060b18] relative overflow-hidden transition-colors">
      {/* Ambient orbs */}
      <div className="fixed -top-32 right-[15%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(15,118,110,0.05)_0%,transparent_65%)] dark:bg-[radial-gradient(circle,rgba(15,118,110,0.1)_0%,transparent_65%)] pointer-events-none" />
      <div className="fixed -bottom-24 left-[8%] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(132,169,140,0.04)_0%,transparent_65%)] dark:bg-[radial-gradient(circle,rgba(132,169,140,0.07)_0%,transparent_65%)] pointer-events-none" />

      <TopBar
        transactionId={id ?? ''}
        propertyAddress={propertyAddress}
        postcode={postcode}
        sellerName={activeJourney === 'seller' ? currentUserName : 'Seller'}
        buyerName={
          // Only show a buyer name once the buyer has joined (buyer principal
          // is distinct from the seller — `assignBuyer` has fired). Before
          // that, hide.
          transaction?.buyer && transaction.buyer !== transaction.seller
            ? activeJourney === 'buyer'
              ? currentUserName
              : 'Buyer'
            : null
        }
        stages={stages}
        totalCostPence={totalCostPence}
        propxchainFeePence={propxchainFeePence}
        providerSelections={providerSelections}
        thumbnailUrl={propertyListing?.images?.[0]?.url}
      />

      <div className="px-5 lg:px-7 py-5 pb-28 lg:pb-8 relative z-10">
        {/* Site context banner — shown when transaction came from developer reservation */}
        {activeJourney === 'buyer' && (
          <SiteContextBanner
            transactionSiteId={siteId}
            transactionSiteName={siteName}
            transactionPlotId={plotId}
          />
        )}

        <TransactionTabs
          context={{
            transactionId: id ?? '',
            uprn,
            postcode: postcode ?? undefined,
            propertyAddress: propertyAddress !== 'Unknown property' ? propertyAddress : undefined,
          }}
          overviewTop={(
            <>

        {/* Lead with the next action. An anxious, once-a-decade seller should
            see what to do before any progress dashboards. AI assistance lives
            in the sidebar, so the next-step card stands alone here. */}
        {/* Admin-only: fire the Move Narrator on demand against the current
            state so the AI card appears in seconds, without needing a real
            blocker change. For testing / demoing the premium push. */}
        {id && (
          <MoveNarratorPreviewButton
            txId={id}
            role={userRole}
            propertyAddress={
              transaction?.propertyAddress || propertyListing?.address || 'Unknown property'
            }
            className="mb-4"
          />
        )}

        {/* Move Narrator "where's my move?" AI card — surfaced inline (and as a
            toast) the moment one is delivered, so premium customers see it in
            context, not only in the notification bell. */}
        {id && <MoveNarratorBanner txId={id} className="mb-4" />}

        {/* Premium with an AI card → the banner above replaces this; otherwise
            (starter, or premium before the first AI card) show the NextStepCard. */}
        {id && !hasAiCard && (
          <div className="mb-4 [&>*]:!mb-0">
            <NextStepCard
              txId={id}
              variant="full"
              presentation="overlay"
              refreshKey={invalidationKey}
              onAction={handleNextStepAction}
              minimisedPortalId={TOPBAR_ACTION_SLOT_ID}
            />
          </div>
        )}

        {/* Stall attribution: who the deal is waiting on and for how long, with
            the stage against its benchmark. Free for every tier, and shown
            whichever of the next-step or AI cards is on screen. */}
        {id && <StallLine transactionId={id} refreshKey={invalidationKey} className="mb-4" />}

        {/* Agent CRM: whom the viewer acts for, or who acts for the viewer, with the withdrawal. */}
        {id && <MandateBanners transactionId={id} myRole={userRole} className="mb-4" />}

        {/* Onboarding banner */}
        <div className="mb-4">
          <OnboardingBanner role={userRole} totalStages={visibleStages.length} />
        </div>

        {/* Horizontal stage tabs — selecting one renders its detail card in
            the main column below. The seller journey gets a selectable
            "Buyer side" tab at stage 4, and the sales pack leads as Stage 0
            so the upfront-information artefact sits before List Property. */}
        <StageTabs
          stages={visibleStages}
          buyerSideOrder={activeJourney === 'seller' ? 4 : undefined}
          salesPackSummary={salesPackSummary}
          activeStageId={resolvedStageId}
          onSelect={selectStage}
          onHelpClick={setHelpStageId}
        />
            </>
          )}
          overview={(
            <>
              {/* SellerFeeCard removed: the £75 fee is paid as a precondition
                  to transaction creation (via /onboarding/payment or
                  /create-transaction's Stripe redirect), so by the time the
                  flow page renders, the fee has always been paid. Listing
                  another property goes through /create-transaction which has
                  its own payment flow. */}

              {resolvedStageId === SALES_PACK_TAB_ID ? (
                <SalesPackTab
                  transactionId={id ?? ''}
                  uprn={uprn}
                  postcode={postcode ?? undefined}
                  propertyAddress={propertyAddress !== 'Unknown property' ? propertyAddress : undefined}
                  locked={false}
                  requiredTier="starter"
                  onGoToStage={selectStage}
                />
              ) : resolvedStageId === BUYER_SIDE_TAB_ID ? (
                <BuyerSideStagePlaceholder stageNumber={4} />
              ) : (
                activeStage && (
                  <div
                    ref={(el) => { if (el) stageRefs.current.set(activeStage.id, el); }}
                  >
                    <StageCard
                      stage={activeStage}
                      isExpanded={detailOpen}
                      onToggle={() => setDetailOpen((open) => !open)}
                      onHelpClick={setHelpStageId}
                      isEditing={editingStageIds.includes(activeStage.id)}
                      onEditClick={EDITABLE_STAGE_IDS.has(activeStage.id)
                        ? (sid) => {
                            if (PROVIDER_EDIT_STAGE_IDS.has(sid)) {
                              // Provider swaps cancel the existing quote
                              // request — gate entry behind a confirm dialog.
                              setConfirmingProviderEdit(sid);
                            } else {
                              setStageEditing(sid, true);
                            }
                          }
                        : undefined}
                    >
                      {detailOpen &&
                        renderStageContent(activeStage.id, {
                          stage: activeStage,
                          onSelectProvider: selectProvider,
                          onClearProvider: clearProvider,
                          onRateProvider: rateProvider,
                          onComplete: completeStage,
                          providerSelection: providerSelections.get(activeStage.id),
                          postcode: postcode || undefined,
                          turboMode,
                          onTurboToggle: setTurboMode,
                          toServiceProvider,
                          inviteCode: inviteCode || undefined,
                          transactionId: id,
                          onListingImported: setPropertyListing,
                          otherPartyStages,
                          // Stamp provider orders with the current user's real
                          // identity — previously these were empty strings so
                          // the search / conveyancer requests had no requester.
                          partyName: currentUserName,
                          partyEmail: currentUserEmail,
                          propertyAddress,
                          // Structured fields straight off the listing, so
                          // supplier orders never depend on re-parsing the
                          // flattened address string.
                          addressParts: propertyListing
                            ? {
                                addressLine1: propertyListing.addressLine1,
                                addressLine2: propertyListing.addressLine2,
                                town: propertyListing.town,
                                county: propertyListing.county,
                                postcode: propertyListing.postcode,
                              }
                            : undefined,
                          propertyValue: propertyListing?.price,
                          uprn: uprn ?? propertyListing?.uprn,
                          tenure: propertyListing?.tenure ?? null,
                          isEditing: editingStageIds.includes(activeStage.id),
                          onCancelEdit: (sid) => setStageEditing(sid, false),
                          onAfterEdit: bumpInvalidationKey,
                          viewerRole: userRole,
                        })}
                    </StageCard>
                  </div>
                )
              )}
            </>
          )}
          sidebar={(
            <>
            {/* Buyer invite code — shown to the seller until a buyer joins.
                Lives here (top of rail) rather than inside PropertyListingCard
                (which only appears after Stage 1 done) so the code is visible
                from the moment the transaction is created. Dismissible —
                restore pill renders in place when hidden. */}
            {activeJourney === 'seller' && (
              inviteDismiss.dismissedTag === null ? (
                <BuyerInviteCard
                  inviteCode={inviteCode}
                  buyerJoined={!!(transaction?.buyer && transaction.buyer !== transaction.seller)}
                  onDismiss={() => inviteDismiss.dismiss()}
                />
              ) : (
                <RestorePill label="invite code" onClick={inviteDismiss.restore} />
              )
            )}

            {/* Help panel (shown when ? is clicked) */}
            {helpStageId && (
              <StageHelpPanel stageId={helpStageId} onClose={() => setHelpStageId(null)} />
            )}

            {/* Property listing card */}
            {(isStage1Done || propertyListing) && (
              <PropertyListingCard listing={propertyListing} inviteCode={inviteCode || undefined} />
            )}

            {/* Other-party progress — back in the sidebar with the reflowed
                layout: the stage tabs only show one journey at a time, so a
                compact read on the other side's progress earns its place. */}
            <OtherPartyProgressCard
              stages={otherPartyStages}
              transactionId={id}
              otherPartyRole={activeJourney === 'seller' ? 'buyer' : 'seller'}
            />

            {/* HMLR title-pull moved into Stage 1's PropertyDetailsForm
                (next to the title-number field). Edit the listing card
                to expand the form and reach the £7 / View existing
                Title button there. */}

            {/* Blockchain Audit link */}
            <a
              href={`/transaction/${id}/audit`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/50 dark:hover:bg-teal-900/30 transition-colors group"
            >
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-teal-700 dark:text-teal-300 font-['DM_Sans'] group-hover:text-teal-800 dark:group-hover:text-teal-200">
                  View Blockchain Audit
                </div>
                <div className="text-xs text-teal-600/70 dark:text-teal-400/70 font-['DM_Sans']">
                  Verified transaction record
                </div>
              </div>
              <svg className="w-4 h-4 ml-auto text-teal-500 dark:text-teal-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            </>
          )}
        />
      </div>

      <CostFooterMobile
        totalCostPence={totalCostPence}
        propxchainFeePence={propxchainFeePence}
        providerSelections={providerSelections}
      />

      <ConfirmEditDialog
        open={confirmingProviderEdit !== null}
        title="Change provider?"
        message="Editing this stage will cancel your current quote request. The new firm will receive a fresh request with all your transaction details. Your existing order is kept on the audit trail for reference."
        confirmLabel="Yes, change provider"
        onConfirm={() => {
          if (confirmingProviderEdit) {
            setStageEditing(confirmingProviderEdit, true);
          }
          setConfirmingProviderEdit(null);
        }}
        onCancel={() => setConfirmingProviderEdit(null)}
      />
    </div>
  );
}
