import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { icpService } from '../services/icp.service';
import { partyRoleService } from '../services/partyRole.service';
import { useAuthStore } from '../stores/authStore';
import { logger } from '@/utils/logger';
import {
  getStagesForJourney,
} from '../utils/stageConfig';
import type { StageConfig, JourneyRole, StageStatus } from '../types/stage.types';
import type { ServiceProvider, ProviderSelection } from '../types/provider.types';
import type { TransactionFlowState } from '../types/flow.types';
import { dealSideOf, principalsOf, type DealSide } from '@/lib/dealAccess';
import { isCompletedStatus } from '@/services/completionStatus';
import { isAtLeastStatus } from '@/types/transactionStatus';
import { sellerConveyancerOf } from '@/lib/completionStatement';
import { conveyancerSideOf, dealConveyancersOf, NO_CONVEYANCERS, type DealConveyancers } from '@/lib/dealConveyancers';

interface TransactionData {
  id: string;
  seller: string | null;
  buyer: string | null;
  inviteCode?: string;
  propertyAddress?: string;
  postcode?: string;
  milestones: Array<{ name: string; status: string; order: number }>;
  parties: Array<{ principal: string; role: string }>;
  /** Principals from the multi-party lists, beyond the single seller/buyer slots. */
  sellers?: string[];
  buyers?: string[];
  /** Live delegations as [party, delegate]: a delegate takes their client's side. */
  delegates?: Array<[string, string]>;
  /** transaction_manager's TransactionStatus as text, e.g. "exchanged". */
  status?: string;
  /** Agreed price from the canister record. */
  amount?: number;
  /** The seller's conveyancer from the solicitor slot, who uploads the completion statement. */
  sellerConveyancer?: string | null;
  /** Each side's conveyancer from the on-chain solicitor slots. */
  conveyancers?: DealConveyancers;
  /** The legacy single `solicitor` principal, from deals made before the per-side slots. */
  legacySolicitor?: string | null;
}

// Completion stages are done only when transaction_manager says the deal has
// completed. Flow-state flags for them (written by the old local checklist)
// are ignored, and completeStage never writes one.
const COMPLETION_STAGE_IDS: ReadonlySet<string> = new Set(['seller-7', 'buyer-7']);

// Contract & Exchange is done when transaction_manager says contracts have
// exchanged. Exchange is recorded by the conveyancers in /pro, so no client
// action ever ticked it, and after a real exchange the client still saw
// "Contract & Exchange: action needed" and "Completion: locked" (card
// 852523fc). Old flow-state flags for it are ignored, like completion's.
const EXCHANGE_STAGE_IDS: ReadonlySet<string> = new Set(['seller-6', 'buyer-6']);
/** Contract & Exchange's place in both journeys (stageConfig). */
const EXCHANGE_STAGE_ORDER = 6;

// Conveyancer stages are done when, for that side: the firm is on the deal
// (its solicitor slot on chain, filled when it redeems its join link), the
// legacy single `solicitor` field is set, or the client has said their
// conveyancer is not on PropXchain and was instructed directly (Marc's
// completion rule: shown as client-confirmed, not verified). Requesting
// estimates used to tick the stage, so a seller saw "Completed" before any
// estimate was accepted; those old bare flags are ignored, and completeStage
// never writes one.
const CONVEYANCER_STAGE_IDS: ReadonlySet<string> = new Set(['seller-5', 'buyer-5']);

/** Flow-state key for the client's own confirmation, distinct from the old bare flag. */
export function clientConfirmedKey(stageId: string): string {
  return `${stageId}:client-confirmed`;
}

/** Text of a Candid `opt Principal` (`[] | [p]`), or null. */
function optPrincipalText(value: unknown): string | null {
  const p: unknown = Array.isArray(value) ? value[0] : value;
  if (!p) return null;
  if (typeof p === 'string') return p || null;
  if (typeof p === 'object' && 'toText' in p) return String((p as { toText: () => string }).toText()) || null;
  return null;
}

/** Stages whose completion comes from chain state, never from a flow-state flag. */
function isDerivedStage(stageId: string): boolean {
  return COMPLETION_STAGE_IDS.has(stageId) || CONVEYANCER_STAGE_IDS.has(stageId) || EXCHANGE_STAGE_IDS.has(stageId);
}

// Candid variant -> its key, e.g. { exchanged: null } -> "exchanged".
function statusKeyOf(status: unknown): string | undefined {
  if (typeof status === 'string') return status;
  if (status && typeof status === 'object') return Object.keys(status)[0];
  return undefined;
}

/** On-chain portion of flow state (shared across devices/users) */
interface ChainFlowState {
  completedStages: Record<string, number>;
  providerSelections: Record<string, ProviderSelection>;
}

interface UseTransactionFlowReturn {
  transaction: TransactionData | null;
  userRole: JourneyRole;
  /** The viewer's side on the deal; drives the access map in lib/dealAccess. */
  dealSide: DealSide;
  /** The side the viewer is the assigned conveyancer for, from the solicitor slots; null for everyone else. */
  conveyancerSide: 'buyer' | 'seller' | null;
  stages: StageConfig[];
  otherPartyStages: StageConfig[];
  activeJourney: JourneyRole;
  setActiveJourney: (j: JourneyRole) => void;
  providerSelections: Map<string, ProviderSelection>;
  selectProvider: (stageId: string, provider: ServiceProvider) => void;
  /** Clear a stage's provider selection + completion. Triggers chain
   *  persist + audit-event log. Does NOT cancel provider-side orders. */
  clearProvider: (stageId: string) => void;
  rateProvider: (stageId: string, rating: number, comment?: string) => void;
  completeStage: (stageId: string) => void;
  /** The client says their conveyancer is not on PropXchain and was
   *  instructed directly: completes seller-5/buyer-5 as client-confirmed. */
  confirmConveyancerDirect: (stageId: string) => void;
  totalCostPence: number;
  expandedStageIds: string[];
  toggleStage: (stageId: string) => void;
  /** Stage ids currently in edit mode (re-opened after completion). */
  editingStageIds: string[];
  /** Toggle edit mode for a completed stage. Edit state is local-only —
   *  not persisted to chain. */
  setStageEditing: (stageId: string, editing: boolean) => void;
  isLoading: boolean;
  error: string | null;
  /**
   * True when the signed-in viewer is not a party to this deal: the chain
   * refused the transaction, no mandate names them, and no party-role row
   * is visible to them. The page shows a not-a-party state instead of
   * composing itself from public and cached data.
   */
  accessDenied: boolean;
  chainPersistError: string | null;
  /** Monotonic counter that bumps after every successful audit-event write
   *  (stage completion, provider selection). Consumers that read the ledger
   *  stream directly (PhaseIndicator, PhaseChecklist) key their refetches
   *  off this so they don't race the event landing on chain. */
  invalidationKey: number;
  /** Manually bump the invalidation key. Used by edit flows that don't go
   *  through completeStage / selectProvider but still write on-chain (e.g.
   *  ListPropertyStage's title-number update) so the NextStepCard,
   *  PhaseIndicator, and PhaseChecklist all refetch. */
  bumpInvalidationKey: () => void;
  /** Synthetic audit events derived from completedStages + providerSelections.
   *  Consumers merge these with the live ledger fetch so the UI still
   *  advances when a real `logEvent` write is slow, queued, or silently
   *  fails. The ledger remains canonical on next reload. */
  syntheticEvents: Array<{ eventType: string; timestamp: number }>;
}

/** Maps stage IDs to ledger_manager audit event types.
 *
 * Every known stage should have its own event type so the audit trail is the
 * source of truth for "what happened when". Stages that fall through to the
 * generic `stage_completed` fallback lose that signal — add mappings here
 * whenever a new stage is introduced. See Ship 2c in the v3 phase-model
 * design (monorepo).
 */
const STAGE_TO_EVENT_TYPE: Record<string, string> = {
  // Seller journey
  'seller-1': 'transaction_created',       // Property listed with address/postcode/title/price
  'seller-2': 'searches_ordered',          // Property searches ordered
  'seller-3': 'seller_forms_completed',    // TA6/TA10/TA7 forms complete
  'seller-5': 'seller_conveyancer_confirmed', // Conveyancer appointed for seller side
  'seller-6': 'contract_exchanged',
  // seller-7 / buyer-7 have no entry: completion is recorded by the canister
  // itself (initiate_blockchain_completion), never by a stage tick.

  // Buyer journey
  'buyer-1': 'buyer_onboarded',            // Buyer finished initial join flow
  'buyer-2': 'mortgage_confirmed',         // Mortgage agreement in principle
  'buyer-3': 'survey_completed',           // Survey done
  'buyer-4': 'sellers_pack_reviewed',      // Buyer reviewed seller pack
  'buyer-5': 'buyer_conveyancer_confirmed',// Conveyancer appointed for buyer side
  'buyer-6': 'contract_exchanged',
  // The client's word that their conveyancer is instructed off PropXchain.
  'seller-5:client-confirmed': 'seller_conveyancer_client_confirmed',
  'buyer-5:client-confirmed': 'buyer_conveyancer_client_confirmed',
};

function stageIdToEventType(stageId: string): string {
  return STAGE_TO_EVENT_TYPE[stageId] ?? 'stage_completed';
}

/** Maps canister milestone names to stage IDs */
const MILESTONE_NAME_TO_STAGE_ID: Record<string, string> = {
  'Property listed': 'seller-1',
  'Property details confirmed': 'seller-1',
  'Searches completed': 'seller-2',
  'Searches ordered': 'seller-2',
  'TA6 form completed': 'seller-3',
  'TA10 form completed': 'seller-3',
  'Property forms complete': 'seller-3',
  'Buyer found': 'seller-4',
  'Buyer joined': 'buyer-1',
  'Buyer matched': 'buyer-1',
  'Mortgage confirmed': 'buyer-2',
  'Survey complete': 'buyer-3',
  'Sellers pack reviewed': 'buyer-4',
};

function getStorageKey(transactionId: string, principalId: string | null): string {
  // Key by principal so a seller + buyer on the same browser don't share
  // the same activeJourney / completedStages / providerSelections state.
  // `anon` is only used on first render before auth hydration — the
  // real hydration re-reads under the principal-scoped key.
  const pid = principalId || 'anon';
  return `txflow:${transactionId}:${pid}`;
}

/**
 * Upgrade older localStorage states to the current shape.
 * v1 used `expandedStageId: string | null`; v2 uses `expandedStageIds: string[]`
 * so the user can keep multiple cards open at once.
 */
export function migrateFlowState(raw: unknown): TransactionFlowState {
  const state = raw as Partial<TransactionFlowState> & { expandedStageId?: string | null };
  const expandedStageIds = Array.isArray(state.expandedStageIds)
    ? state.expandedStageIds
    : state.expandedStageId
      ? [state.expandedStageId]
      : [];
  return {
    activeJourney: state.activeJourney ?? 'seller',
    // Pre-migration state never had a userPreferredJourney field — no UI
    // toggle existed, so any persisted `activeJourney` was always a default
    // derived at mount, not an explicit choice. Start everyone at `null`
    // so the next mount re-derives instead of locking in a stale default.
    userPreferredJourney: state.userPreferredJourney ?? null,
    providerSelections: state.providerSelections ?? {},
    completedStages: state.completedStages ?? {},
    expandedStageIds,
    editingStageIds: Array.isArray(state.editingStageIds) ? state.editingStageIds : [],
  };
}

function loadFlowState(transactionId: string, principalId: string | null): TransactionFlowState {
  try {
    const raw = localStorage.getItem(getStorageKey(transactionId, principalId));
    if (raw) {
      return migrateFlowState(JSON.parse(raw));
    }
  } catch {
    // Corrupted localStorage — use defaults
  }
  return {
    activeJourney: 'seller',
    userPreferredJourney: null,
    providerSelections: {},
    completedStages: {},
    expandedStageIds: [],
    editingStageIds: [],
  };
}

function saveFlowState(
  transactionId: string,
  principalId: string | null,
  state: TransactionFlowState,
): void {
  localStorage.setItem(getStorageKey(transactionId, principalId), JSON.stringify(state));
}

/** Persist shared state (completions + providers) to canister. Returns success/failure. */
async function persistToChain(transactionId: string, state: TransactionFlowState): Promise<boolean> {
  const chainState: ChainFlowState = {
    completedStages: state.completedStages,
    providerSelections: state.providerSelections,
  };
  try {
    await icpService.setFlowState(transactionId, chainState);
    return true;
  } catch (err) {
    logger.error('[Flow] Failed to persist to chain:', err);
    // Retry once
    try {
      await icpService.setFlowState(transactionId, chainState);
      return true;
    } catch (retryErr) {
      logger.error('[Flow] Chain persist retry failed:', retryErr);
      return false;
    }
  }
}

/**
 * Whether a signed-in viewer has no standing on this deal at all. Three
 * independent signals must all say no: the canister refused the read (null,
 * not a failure), no live mandate names the viewer as a delegate, and no
 * party-role row is visible to them under RLS. Any one of them saying yes
 * keeps the page open, so an estate agent or a delegate the chain does not
 * list is never locked out by this check alone. Unsigned viewers are not
 * judged here; the route guard owns them.
 */
async function isNotAParty(
  transactionId: string,
  principalId: string | null,
  txRead: { tx: unknown; failed: boolean },
  delegates: ReadonlyArray<[string, string]>,
): Promise<boolean> {
  if (!principalId || txRead.failed || txRead.tx !== null) return false;
  if (delegates.some(([, delegate]) => delegate === principalId)) return false;
  try {
    const rows = await partyRoleService.listForTransaction(transactionId);
    return rows.length === 0;
  } catch {
    // Could not ask Supabase either: leave the page as it was rather than
    // lock someone out on a flaky connection.
    return false;
  }
}

function deriveUserRole(
  transaction: TransactionData | null,
  principalId: string | null,
): JourneyRole {
  // Before the deal loads, default to seller. Afterwards only the buyer gets
  // the buyer journey; the seller and anyone acting with them (agent,
  // delegate, bot) work the seller journey, under lib/dealAccess limits.
  if (!transaction || !principalId) return 'seller';
  return deriveDealSide(transaction, principalId) === 'buyer' ? 'buyer' : 'seller';
}

function deriveDealSide(transaction: TransactionData | null, principalId: string | null): DealSide {
  if (!transaction) return 'other';
  return dealSideOf(transaction, principalId);
}

function buildCompletedStageIds(
  transaction: TransactionData | null,
  flowState: TransactionFlowState,
): Set<string> {
  const completed = new Set<string>();

  // From canister milestones
  if (transaction?.milestones) {
    for (const milestone of transaction.milestones) {
      if (milestone.status === 'completed') {
        const stageId = MILESTONE_NAME_TO_STAGE_ID[milestone.name];
        if (stageId) completed.add(stageId);
      }
    }
  }

  // From localStorage completedAt on provider selections
  for (const [stageId, selection] of Object.entries(
    flowState.providerSelections,
  )) {
    if (selection.completedAt && !isDerivedStage(stageId)) completed.add(stageId);
  }

  // From localStorage completedStages (non-provider stages like List Property)
  if (flowState.completedStages) {
    for (const stageId of Object.keys(flowState.completedStages)) {
      if (!isDerivedStage(stageId)) completed.add(stageId);
    }
  }

  if (isCompletedStatus(transaction?.status)) {
    for (const stageId of COMPLETION_STAGE_IDS) completed.add(stageId);
  }

  // Once contracts have exchanged, everything before exchange is behind the
  // deal: a stage the client never ticked here (a survey or mortgage sorted
  // elsewhere) must not read "action needed" on an exchanged deal (Marc,
  // 2026-11-08). Exchange itself comes from the chain, as above.
  if (isAtLeastStatus(transaction?.status, 'exchanged')) {
    for (const stageId of EXCHANGE_STAGE_IDS) completed.add(stageId);
    for (const stage of [...getStagesForJourney('seller'), ...getStagesForJourney('buyer')]) {
      if (stage.order < EXCHANGE_STAGE_ORDER) completed.add(stage.id);
    }
  }

  for (const stageId of CONVEYANCER_STAGE_IDS) {
    if (conveyancerBasis(stageId, transaction, flowState)) completed.add(stageId);
  }

  // buyer-1 auto-completes when a real buyer is on chain. `buyer === seller`
  // is the placeholder seeded by createTransaction before assignBuyer fires,
  // so we must check inequality — otherwise buyer-1 would flash "completed"
  // for the seller too.
  if (transaction?.buyer && transaction.buyer !== transaction.seller) {
    completed.add('buyer-1');
  }

  return completed;
}

/**
 * Why a conveyancer stage is complete, or null when it is not. A filled slot
 * or the legacy field is verified on chain; otherwise the client's explicit
 * confirmation counts, marked as theirs.
 */
function conveyancerBasis(
  stageId: string,
  transaction: TransactionData | null,
  flowState: TransactionFlowState,
): 'verified' | 'client-confirmed' | null {
  // The same slots the deal page's conveyancer line reads (lib/dealConveyancers).
  const slot = stageId === 'seller-5' ? transaction?.conveyancers?.seller : transaction?.conveyancers?.buyer;
  if (slot || transaction?.legacySolicitor) return 'verified';
  if (flowState.completedStages?.[clientConfirmedKey(stageId)]) return 'client-confirmed';
  return null;
}

function resolveStageStatus(
  stageId: string,
  prereqs: string[],
  completedIds: Set<string>,
  activeJourney: JourneyRole,
  transaction: TransactionData | null,
): StageStatus {
  // Already completed
  if (completedIds.has(stageId)) return 'completed';

  // SPECIAL CASE: seller-4 (Buyer Progress) is a passive monitor of the
  // buyer's journey, not a seller task — it has no milestone of its own. It
  // therefore can't go 'completed' via the normal completedIds path, which
  // left it permanently 'active' and capped the seller's progress counter at
  // 6/7 even after the whole transaction completed (off-by-one). Resolve it
  // from transaction state instead: watching with no buyer, completed once
  // the seller's own journey reaches Completion (seller-7 — reliably in the
  // seller's completedIds), active while a buyer is present but mid-flow.
  if (stageId === 'seller-4') {
    if (!transaction?.buyer) return 'watching';
    return completedIds.has('seller-7') ? 'completed' : 'active';
  }

  // SPECIAL CASE: buyer-1 auto-completes when a real buyer is on chain.
  // `buyer === seller` is the create-time placeholder, not a real buyer —
  // see buildCompletedStageIds for the same check.
  if (
    stageId === 'buyer-1'
    && transaction?.buyer
    && transaction.buyer !== transaction.seller
  ) {
    return 'completed';
  }

  // No prereqs — first stage or special
  if (prereqs.length === 0) return 'active';

  const oppositePrefix = activeJourney === 'seller' ? 'buyer-' : 'seller-';
  let allPrereqsMet = true;
  let hasCrossJourneyBlock = false;

  for (const prereq of prereqs) {
    if (!completedIds.has(prereq)) {
      allPrereqsMet = false;
      if (prereq.startsWith(oppositePrefix)) {
        hasCrossJourneyBlock = true;
      }
    }
  }

  if (allPrereqsMet) return 'active';
  if (hasCrossJourneyBlock) return 'watching';
  return 'locked';
}

function resolveStages(
  journey: JourneyRole,
  transaction: TransactionData | null,
  completedIds: Set<string>,
  flowState: TransactionFlowState,
): StageConfig[] {
  const templates = getStagesForJourney(journey);

  return templates.map((template) => {
    const stage: StageConfig = {
      ...template,
      status: resolveStageStatus(
        template.id,
        template.prerequisiteStageIds,
        completedIds,
        journey,
        transaction,
      ),
    };
    if (CONVEYANCER_STAGE_IDS.has(template.id)
      && conveyancerBasis(template.id, transaction, flowState) === 'client-confirmed') {
      stage.completionBasis = 'client-confirmed';
    }
    return stage;
  });
}

export function useTransactionFlow(
  transactionId: string,
): UseTransactionFlowReturn {
  const { principalId } = useAuthStore();

  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [flowState, setFlowState] = useState<TransactionFlowState>(() =>
    loadFlowState(transactionId, principalId ?? null),
  );
  const chainSynced = useRef(false);
  // Latest flow state for event handlers, so they compute the next state
  // outside a setState updater (see commitFlowState). Kept in step on every
  // render and set at once by commitFlowState, so back-to-back calls in one
  // tick each see the previous call's result.
  const flowStateRef = useRef(flowState);
  flowStateRef.current = flowState;
  const [invalidationKey, setInvalidationKey] = useState(0);
  const bumpInvalidationKey = useCallback((): void => {
    setInvalidationKey((k) => k + 1);
  }, []);

  // Fetch transaction + chain flow state on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchTransaction(): Promise<void> {
      try {
        setIsLoading(true);
        // A refused read resolves null; a failed one (network, canister
        // down) rejects and is kept apart, because "could not ask" must
        // never read as "not allowed".
        const [progress, txRead, chainState, delegates] = await Promise.all([
          icpService.getTransactionProgress(transactionId).catch(() => null),
          icpService.getTransaction(transactionId).then(
            (tx) => ({ tx, failed: false as const }),
            () => ({ tx: null, failed: true as const }),
          ),
          icpService.getFlowState(transactionId).catch(() => null),
          icpService.getDelegates(transactionId),
        ]);
        const fullTx = txRead.tx;
        if (!cancelled) {
          setAccessDenied(
            await isNotAParty(transactionId, principalId ?? null, txRead, delegates),
          );
          const txData: TransactionData = {
            id: transactionId,
            seller: fullTx?.seller?.toString() ?? (progress as TransactionData | null)?.seller ?? null,
            buyer: fullTx?.buyer?.toString() ?? (progress as TransactionData | null)?.buyer ?? null,
            inviteCode: fullTx?.inviteCode || undefined,
            propertyAddress: fullTx?.propertyAddress,
            postcode: fullTx?.postcode,
            milestones: (progress as TransactionData | null)?.milestones ?? [],
            parties: (progress as TransactionData | null)?.parties ?? [],
            sellers: principalsOf(fullTx?.sellers),
            buyers: principalsOf(fullTx?.buyers),
            delegates,
            status: statusKeyOf(fullTx?.status),
            amount: fullTx?.amount != null ? Number(fullTx.amount) : undefined,
            sellerConveyancer: sellerConveyancerOf(fullTx?.sellerSolicitor),
            conveyancers: dealConveyancersOf(fullTx),
            legacySolicitor: optPrincipalText(fullTx?.solicitor),
          };
          setTransaction(txData);

          // Merge chain state with localStorage. Chain wins for shared data.
          const local = loadFlowState(transactionId, principalId ?? null);
          const mergedCompletedStages = {
            ...local.completedStages,
            ...(chainState?.completedStages ?? {}),
          };
          const mergedProviders = {
            ...local.providerSelections,
            ...((chainState?.providerSelections ?? {}) as Record<string, ProviderSelection>),
          };
          // Derive the journey from the user's role in the transaction.
          // This effect depends on principalId, so the moment the Zustand
          // store hydrates the real principal we re-run and flip a buyer
          // that had landed on the 'seller' default into the buyer view.
          const userRole = deriveUserRole(txData, principalId ?? null);
          const merged: TransactionFlowState = {
            // A real principal always gets their own journey (see
            // activeJourney below); the stored preference only fills the
            // gap before the principal hydrates.
            activeJourney: principalId ? userRole : (local.userPreferredJourney ?? userRole),
            userPreferredJourney: local.userPreferredJourney,
            expandedStageIds: local.expandedStageIds,
            completedStages: mergedCompletedStages,
            providerSelections: mergedProviders,
            editingStageIds: local.editingStageIds,
          };
          setFlowState(merged);
          // Only persist once we have a real principal. Writing under the
          // 'anon' fallback key creates ghost state that the real-principal
          // mount can't see, and on a shared device it can spill across
          // users (see #28 in the buyer-side walkthrough).
          if (principalId) {
            saveFlowState(transactionId, principalId, merged);
          }

          // If local had data that chain didn't, migrate it up
          const localHasExtra =
            Object.keys(local.completedStages).length > Object.keys(chainState?.completedStages ?? {}).length
            || Object.keys(local.providerSelections).length > Object.keys((chainState?.providerSelections ?? {}) as Record<string, unknown>).length;
          if (!chainState || localHasExtra) {
            persistToChain(transactionId, merged);
          }
          chainSynced.current = true;

          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load transaction',
          );
          setIsLoading(false);
        }
      }
    }

    fetchTransaction();
    return () => {
      cancelled = true;
    };
    // principalId belongs in deps: the Zustand store hydrates the ICP
    // principal after Supabase signIn resolves, so the first render of
    // this hook can fire with principalId=null. Re-running on principalId
    // change lets us re-derive the journey under the real user.
  }, [transactionId, principalId]);

  const userRole = useMemo(
    () => deriveUserRole(transaction, principalId ?? null),
    [transaction, principalId],
  );

  const dealSide = useMemo(
    () => deriveDealSide(transaction, principalId ?? null),
    [transaction, principalId],
  );

  const conveyancerSide = useMemo(
    () => conveyancerSideOf(transaction?.conveyancers ?? NO_CONVEYANCERS, principalId ?? null),
    [transaction, principalId],
  );

  // Once the deal has loaded, the journey is the viewer's own and nothing
  // else: a stored preference (or a hand-edited localStorage entry) can't
  // put a buyer into the seller's journey, or the reverse.
  const activeJourney = transaction && principalId ? userRole : flowState.activeJourney;

  const completedIds = useMemo(
    () => buildCompletedStageIds(transaction, flowState),
    [transaction, flowState],
  );

  const stages = useMemo(
    () => resolveStages(activeJourney, transaction, completedIds, flowState),
    [activeJourney, transaction, completedIds, flowState],
  );

  const otherJourney: JourneyRole =
    activeJourney === 'seller' ? 'buyer' : 'seller';
  const otherPartyStages = useMemo(
    () => resolveStages(otherJourney, transaction, completedIds, flowState),
    [otherJourney, transaction, completedIds, flowState],
  );

  const providerSelections = useMemo(() => {
    const map = new Map<string, ProviderSelection>();
    for (const [stageId, selection] of Object.entries(
      flowState.providerSelections,
    )) {
      map.set(stageId, selection);
    }
    return map;
  }, [flowState.providerSelections]);

  const totalCostPence = useMemo(() => {
    let sum = 0;
    for (const selection of providerSelections.values()) {
      sum += selection.costPence;
    }
    return sum;
  }, [providerSelections]);

  // Derive audit-event-shaped objects from local completion state so
  // PhaseIndicator / PhaseChecklist can advance even when the chain write
  // is in flight or failed. Every completed stage yields its mapped event
  // type; every picked provider yields a `provider_selected` event.
  const syntheticEvents = useMemo(() => {
    const out: Array<{ eventType: string; timestamp: number }> = [];
    for (const [stageId, ts] of Object.entries(flowState.completedStages)) {
      if (CONVEYANCER_STAGE_IDS.has(stageId)) continue; // stale flag, see CONVEYANCER_STAGE_IDS
      out.push({ eventType: stageIdToEventType(stageId), timestamp: Number(ts) || Date.now() });
    }
    for (const [, sel] of Object.entries(flowState.providerSelections)) {
      if (sel?.selectedAt) {
        out.push({ eventType: 'provider_selected', timestamp: Number(sel.selectedAt) });
      }
    }
    return out;
  }, [flowState.completedStages, flowState.providerSelections]);

  /**
   * The one place flow state changes after load. The next state is computed
   * from flowStateRef outside any setState updater, then stored, saved and
   * (when asked) written to chain exactly once. Updaters must be pure: React
   * may run them twice (StrictMode, interrupted renders), and the old
   * updaters wrote to chain, and so double-wrote, on every extra run.
   */
  const commitFlowState = useCallback(
    (next: TransactionFlowState, persistChain: boolean): Promise<boolean> | null => {
      flowStateRef.current = next;
      setFlowState(next);
      saveFlowState(transactionId, principalId ?? null, next);
      return persistChain ? persistToChain(transactionId, next) : null;
    },
    [transactionId, principalId],
  );

  /** Update flow state in localStorage + chain (for shared data changes). */
  function updateFlowState(
    partial: Partial<TransactionFlowState>,
    persistChain = false,
  ): void {
    commitFlowState({ ...flowStateRef.current, ...partial }, persistChain && chainSynced.current);
  }

  const setActiveJourney = useCallback(
    (j: JourneyRole): void => {
      // Setting `userPreferredJourney` alongside `activeJourney` is what
      // distinguishes an explicit user toggle from the default derived on
      // mount. The next mount honours this preference instead of
      // re-deriving from `transaction.buyer === principalId`.
      updateFlowState({ activeJourney: j, userPreferredJourney: j });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitFlowState],
  );

  const selectProvider = useCallback(
    (stageId: string, provider: ServiceProvider): void => {
      const selection: ProviderSelection = {
        stageId,
        providerId: provider.id,
        costPence: provider.priceInPence,
        selectedAt: Date.now(),
      };
      const prev = flowStateRef.current;
      commitFlowState({
        ...prev,
        providerSelections: { ...prev.providerSelections, [stageId]: selection },
      }, true);

      // Fire-and-forget audit event — must not block the UI. Bumps the
      // invalidation key on success so PhaseIndicator / PhaseChecklist
      // refetch *after* the event lands on chain.
      void icpService.ledgerManager
        ?.logEvent(
          transactionId,
          'provider_selected',
          `Provider ${provider.name} (${provider.id}) selected for ${stageId}`,
          [JSON.stringify({ stageId, providerId: provider.id, costPence: provider.priceInPence })],
        )
        .then(() => bumpInvalidationKey())
        .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId, eventType: 'provider_selected', err }));
    },
    [transactionId, commitFlowState, bumpInvalidationKey],
  );

  /**
   * Clear a stage's provider selection + completion. Used by the in-panel
   * "Re-order" affordance (currently wired to seller-2) and for QA reset.
   * Persists to chain and logs a provider_cleared audit event so the trail
   * shows the clear.
   *
   * Provider-side state (Supabase search_orders rows, real PISCES orders on
   * Jamie's side) is NOT touched — those are audit trail and must be
   * cancelled out-of-band if the user wants to actually undo a real-mode
   * order. This call clears the on-chain selection only.
   */
  const clearProvider = useCallback(
    (stageId: string): void => {
      const prev = flowStateRef.current;
      const nextProviderSelections = { ...prev.providerSelections };
      delete nextProviderSelections[stageId];
      const nextCompletedStages = { ...prev.completedStages };
      delete nextCompletedStages[stageId];
      commitFlowState({
        ...prev,
        providerSelections: nextProviderSelections,
        completedStages: nextCompletedStages,
      }, true);

      void icpService.ledgerManager
        ?.logEvent(
          transactionId,
          'provider_cleared',
          `Provider selection cleared for ${stageId}`,
          [JSON.stringify({ stageId })],
        )
        .then(() => bumpInvalidationKey())
        .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId, eventType: 'provider_cleared', err }));
    },
    [transactionId, commitFlowState, bumpInvalidationKey],
  );

  const rateProvider = useCallback(
    (stageId: string, rating: number, comment?: string): void => {
      const prev = flowStateRef.current;
      const existing = prev.providerSelections[stageId];
      if (!existing) return;
      commitFlowState({
        ...prev,
        providerSelections: {
          ...prev.providerSelections,
          [stageId]: {
            ...existing,
            review: {
              providerId: existing.providerId,
              transactionId,
              rating,
              comment,
              createdAt: Date.now(),
            },
          },
        },
      }, true);
    },
    [transactionId, commitFlowState],
  );

  const [chainPersistError, setChainPersistError] = useState<string | null>(null);

  const completeStage = useCallback(
    (stageId: string): void => {
      if (COMPLETION_STAGE_IDS.has(stageId)) {
        // CompletionStage calls this only after transaction_manager reports
        // the deal completed. Reflect that status here so the stage shows as
        // done without a reload; nothing is persisted and no audit event is
        // logged, because the canister has already recorded completion.
        setTransaction((prev) => (prev && !isCompletedStatus(prev.status)
          ? { ...prev, status: 'blockchain_completed' }
          : prev));
        return;
      }
      // The conveyancer's join is recorded on chain by the firm itself;
      // a flag or a "confirmed" audit event from here would be a false claim.
      if (CONVEYANCER_STAGE_IDS.has(stageId)) return;
      setChainPersistError(null);
      const prev = flowStateRef.current;
      const now = Date.now();
      // The stage's panel calls this only once the order, referral or quote
      // request has really gone through, so this is where a picked provider
      // is marked done — never on a timer after merely picking one.
      const selection = prev.providerSelections[stageId];
      void commitFlowState({
        ...prev,
        providerSelections: selection && !selection.completedAt
          ? { ...prev.providerSelections, [stageId]: { ...selection, completedAt: now } }
          : prev.providerSelections,
        completedStages: { ...prev.completedStages, [stageId]: now },
      }, true)?.then((success) => {
        if (!success) {
          setChainPersistError(`Stage ${stageId} saved locally but failed to record on-chain. Please retry.`);
        }
      });

      // Fire-and-forget audit event — must not block the UI. Bumps the
      // invalidation key on success so downstream phase readers refetch
      // after the event lands.
      void icpService.ledgerManager
        ?.logEvent(
          transactionId,
          stageIdToEventType(stageId),
          `Stage ${stageId} marked complete`,
          [],
        )
        .then(() => bumpInvalidationKey())
        .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId, eventType: stageIdToEventType(stageId), err }));
    },
    [transactionId, commitFlowState, bumpInvalidationKey],
  );

  const confirmConveyancerDirect = useCallback(
    (stageId: string): void => {
      if (!CONVEYANCER_STAGE_IDS.has(stageId)) return;
      const key = clientConfirmedKey(stageId);
      const prev = flowStateRef.current;
      if (prev.completedStages[key]) return; // already confirmed: no second write or event
      setChainPersistError(null);
      void commitFlowState(
        { ...prev, completedStages: { ...prev.completedStages, [key]: Date.now() } },
        true,
      )?.then((success) => {
        if (!success) setChainPersistError('Your confirmation was saved on this device but not recorded on-chain. Please try again.');
      });
      // The audit trail records it as the client's word, under its own event type.
      void icpService.ledgerManager
        ?.logEvent(transactionId, stageIdToEventType(key), `${stageId}: client confirmed a conveyancer instructed off PropXchain`, [])
        .then(() => bumpInvalidationKey())
        .catch((err: unknown) => logger.error('[audit] logEvent failed', { transactionId, eventType: stageIdToEventType(key), err }));
    },
    [transactionId, commitFlowState, bumpInvalidationKey],
  );

  const toggleStage = useCallback(
    (stageId: string): void => {
      const prev = flowStateRef.current;
      const isOpen = prev.expandedStageIds.includes(stageId);
      const nextIds = isOpen
        ? prev.expandedStageIds.filter((id) => id !== stageId)
        : [...prev.expandedStageIds, stageId];
      commitFlowState({ ...prev, expandedStageIds: nextIds }, false);
    },
    [commitFlowState],
  );

  const setStageEditing = useCallback(
    (stageId: string, editing: boolean): void => {
      const prev = flowStateRef.current;
      const already = prev.editingStageIds.includes(stageId);
      if (editing === already) return;
      const nextIds = editing
        ? [...prev.editingStageIds, stageId]
        : prev.editingStageIds.filter((id) => id !== stageId);
      // Editing implies the card must be expanded so the form is visible.
      const nextExpanded = editing && !prev.expandedStageIds.includes(stageId)
        ? [...prev.expandedStageIds, stageId]
        : prev.expandedStageIds;
      commitFlowState({
        ...prev,
        editingStageIds: nextIds,
        expandedStageIds: nextExpanded,
      }, false);
    },
    [commitFlowState],
  );

  return {
    transaction,
    userRole,
    dealSide,
    conveyancerSide,
    stages,
    otherPartyStages,
    activeJourney,
    setActiveJourney,
    providerSelections,
    selectProvider,
    clearProvider,
    rateProvider,
    completeStage,
    confirmConveyancerDirect,
    totalCostPence,
    expandedStageIds: flowState.expandedStageIds,
    toggleStage,
    editingStageIds: flowState.editingStageIds,
    setStageEditing,
    isLoading,
    error,
    accessDenied,
    chainPersistError,
    invalidationKey,
    bumpInvalidationKey,
    syntheticEvents,
  };
}
