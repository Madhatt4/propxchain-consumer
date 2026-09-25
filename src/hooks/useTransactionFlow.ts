import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { icpService } from '../services/icp.service';
import { useAuthStore } from '../stores/authStore';
import { useSubscription } from './useSubscription';
import { logger } from '@/utils/logger';
import {
  getStagesForJourney,
  PROPXCHAIN_FEE_PENCE,
} from '../utils/stageConfig';
import type { StageConfig, JourneyRole, StageStatus } from '../types/stage.types';
import type { ServiceProvider, ProviderSelection } from '../types/provider.types';
import type { TransactionFlowState } from '../types/flow.types';

interface TransactionData {
  id: string;
  seller: string | null;
  buyer: string | null;
  inviteCode?: string;
  propertyAddress?: string;
  postcode?: string;
  milestones: Array<{ name: string; status: string; order: number }>;
  parties: Array<{ principal: string; role: string }>;
}

/** On-chain portion of flow state (shared across devices/users) */
interface ChainFlowState {
  completedStages: Record<string, number>;
  providerSelections: Record<string, ProviderSelection>;
}

interface UseTransactionFlowReturn {
  transaction: TransactionData | null;
  userRole: JourneyRole;
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
  totalCostPence: number;
  /** The PropXchain fee already included in totalCostPence — £75 (7500p) for
   *  premium tiers, £0 for the free Starter tier. Breakdown UIs read this so
   *  the fee line is gated identically to the running total. */
  propxchainFeePence: number;
  expandedStageIds: string[];
  toggleStage: (stageId: string) => void;
  /** Stage ids currently in edit mode (re-opened after completion). */
  editingStageIds: string[];
  /** Toggle edit mode for a completed stage. Edit state is local-only —
   *  not persisted to chain. */
  setStageEditing: (stageId: string, editing: boolean) => void;
  isLoading: boolean;
  error: string | null;
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
  'seller-7': 'blockchain_completed',

  // Buyer journey
  'buyer-1': 'buyer_onboarded',            // Buyer finished initial join flow
  'buyer-2': 'mortgage_confirmed',         // Mortgage agreement in principle
  'buyer-3': 'survey_completed',           // Survey done
  'buyer-4': 'sellers_pack_reviewed',      // Buyer reviewed seller pack
  'buyer-5': 'buyer_conveyancer_confirmed',// Conveyancer appointed for buyer side
  'buyer-6': 'contract_exchanged',
  'buyer-7': 'blockchain_completed',
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

function deriveUserRole(
  transaction: TransactionData | null,
  principalId: string | null,
): JourneyRole {
  if (!transaction || !principalId) return 'seller';
  // When seller === buyer (no real buyer yet), default to seller
  if (transaction.seller === transaction.buyer) return 'seller';
  if (transaction.buyer === principalId) return 'buyer';
  return 'seller';
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
    if (selection.completedAt) completed.add(stageId);
  }

  // From localStorage completedStages (non-provider stages like List Property)
  if (flowState.completedStages) {
    for (const stageId of Object.keys(flowState.completedStages)) {
      completed.add(stageId);
    }
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
): StageConfig[] {
  const templates = getStagesForJourney(journey);

  return templates.map((template) => ({
    ...template,
    status: resolveStageStatus(
      template.id,
      template.prerequisiteStageIds,
      completedIds,
      journey,
      transaction,
    ),
  }));
}

export function useTransactionFlow(
  transactionId: string,
): UseTransactionFlowReturn {
  const { principalId } = useAuthStore();

  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<TransactionFlowState>(() =>
    loadFlowState(transactionId, principalId ?? null),
  );
  const chainSynced = useRef(false);
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
        const [progress, fullTx, chainState] = await Promise.all([
          icpService.getTransactionProgress(transactionId).catch(() => null),
          icpService.getTransaction(transactionId).catch(() => null),
          icpService.getFlowState(transactionId).catch(() => null),
        ]);
        if (!cancelled) {
          const txData: TransactionData = {
            id: transactionId,
            seller: fullTx?.seller?.toString() ?? (progress as TransactionData | null)?.seller ?? null,
            buyer: fullTx?.buyer?.toString() ?? (progress as TransactionData | null)?.buyer ?? null,
            inviteCode: fullTx?.inviteCode || undefined,
            propertyAddress: fullTx?.propertyAddress,
            postcode: fullTx?.postcode,
            milestones: (progress as TransactionData | null)?.milestones ?? [],
            parties: (progress as TransactionData | null)?.parties ?? [],
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
          // Honour an explicit user toggle (userPreferredJourney) if one is
          // set; otherwise always re-derive on every mount. This effect
          // depends on principalId, so the moment the Zustand store
          // hydrates the real principal we re-run and flip a buyer that
          // had landed on the 'seller' default into the buyer view.
          const userRole = deriveUserRole(txData, principalId ?? null);
          const merged: TransactionFlowState = {
            activeJourney: local.userPreferredJourney ?? userRole,
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

  const activeJourney = flowState.activeJourney;

  const completedIds = useMemo(
    () => buildCompletedStageIds(transaction, flowState),
    [transaction, flowState],
  );

  const stages = useMemo(
    () => resolveStages(activeJourney, transaction, completedIds),
    [activeJourney, transaction, completedIds],
  );

  const otherJourney: JourneyRole =
    activeJourney === 'seller' ? 'buyer' : 'seller';
  const otherPartyStages = useMemo(
    () => resolveStages(otherJourney, transaction, completedIds),
    [otherJourney, transaction, completedIds],
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

  // The free Starter tier carries no £75 PropXchain fee — it only applies to
  // premium tiers. Gating it here keeps a single source of truth that both the
  // running-total number and the cost-breakdown line items read from.
  const { isPremium } = useSubscription();
  const propxchainFeePence = isPremium ? PROPXCHAIN_FEE_PENCE : 0;

  const totalCostPence = useMemo(() => {
    let sum = propxchainFeePence;
    for (const selection of providerSelections.values()) {
      sum += selection.costPence;
    }
    return sum;
  }, [providerSelections, propxchainFeePence]);

  // Derive audit-event-shaped objects from local completion state so
  // PhaseIndicator / PhaseChecklist can advance even when the chain write
  // is in flight or failed. Every completed stage yields its mapped event
  // type; every picked provider yields a `provider_selected` event.
  const syntheticEvents = useMemo(() => {
    const out: Array<{ eventType: string; timestamp: number }> = [];
    for (const [stageId, ts] of Object.entries(flowState.completedStages)) {
      out.push({ eventType: stageIdToEventType(stageId), timestamp: Number(ts) || Date.now() });
    }
    for (const [, sel] of Object.entries(flowState.providerSelections)) {
      if (sel?.selectedAt) {
        out.push({ eventType: 'provider_selected', timestamp: Number(sel.selectedAt) });
      }
    }
    return out;
  }, [flowState.completedStages, flowState.providerSelections]);

  /** Update flow state in localStorage + chain (for shared data changes). */
  function updateFlowState(
    partial: Partial<TransactionFlowState>,
    persistChain = false,
  ): void {
    setFlowState((prev) => {
      const next = { ...prev, ...partial };
      saveFlowState(transactionId, principalId ?? null, next);
      if (persistChain && chainSynced.current) {
        persistToChain(transactionId, next);
      }
      return next;
    });
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
    [transactionId],
  );

  const selectProvider = useCallback(
    (stageId: string, provider: ServiceProvider): void => {
      const selection: ProviderSelection = {
        stageId,
        providerId: provider.id,
        costPence: provider.priceInPence,
        selectedAt: Date.now(),
      };
      setFlowState((prev) => {
        const next = {
          ...prev,
          providerSelections: {
            ...prev.providerSelections,
            [stageId]: selection,
          },
        };
        saveFlowState(transactionId, principalId ?? null, next);
        persistToChain(transactionId, next);
        return next;
      });

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

      // DEMO STOPGAP: optimistically flag the provider as "verified" after
      // 2s so the UI moves on. The real flow will receive a webhook or
      // canister event from the provider (Landmark, tmGroup, etc.) when
      // the order actually lands, and the stage will complete on that
      // signal. Must be replaced before live rollout — otherwise a user
      // who picks any provider sees the stage complete regardless of
      // whether the order succeeded.
      // TODO(providers-phase): replace with real completion event from
      // the provider-integration canister / worker.
      setTimeout(() => {
        setFlowState((prev) => {
          const existing = prev.providerSelections[stageId];
          if (!existing || existing.completedAt) return prev;
          const next = {
            ...prev,
            providerSelections: {
              ...prev.providerSelections,
              [stageId]: { ...existing, completedAt: Date.now() },
            },
            completedStages: {
              ...prev.completedStages,
              [stageId]: Date.now(),
            },
          };
          saveFlowState(transactionId, principalId ?? null, next);
          persistToChain(transactionId, next);
          return next;
        });
      }, 2000);
    },
    [transactionId],
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
      setFlowState((prev) => {
        const nextProviderSelections = { ...prev.providerSelections };
        delete nextProviderSelections[stageId];
        const nextCompletedStages = { ...prev.completedStages };
        delete nextCompletedStages[stageId];
        const next = {
          ...prev,
          providerSelections: nextProviderSelections,
          completedStages: nextCompletedStages,
        };
        saveFlowState(transactionId, principalId ?? null, next);
        persistToChain(transactionId, next);
        return next;
      });

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
    [transactionId],
  );

  const rateProvider = useCallback(
    (stageId: string, rating: number, comment?: string): void => {
      setFlowState((prev) => {
        const existing = prev.providerSelections[stageId];
        if (!existing) return prev;
        const next = {
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
        };
        saveFlowState(transactionId, principalId ?? null, next);
        persistToChain(transactionId, next);
        return next;
      });
    },
    [transactionId],
  );

  const [chainPersistError, setChainPersistError] = useState<string | null>(null);

  const completeStage = useCallback(
    (stageId: string): void => {
      setChainPersistError(null);
      setFlowState((prev) => {
        const next = {
          ...prev,
          completedStages: {
            ...prev.completedStages,
            [stageId]: Date.now(),
          },
        };
        saveFlowState(transactionId, principalId ?? null, next);
        // Persist to chain outside the state setter so we can await
        persistToChain(transactionId, next).then((success) => {
          if (!success) {
            setChainPersistError(`Stage ${stageId} saved locally but failed to record on-chain. Please retry.`);
          }
        });
        return next;
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
    [transactionId],
  );

  const toggleStage = useCallback(
    (stageId: string): void => {
      setFlowState((prev) => {
        const isOpen = prev.expandedStageIds.includes(stageId);
        const nextIds = isOpen
          ? prev.expandedStageIds.filter((id) => id !== stageId)
          : [...prev.expandedStageIds, stageId];
        const next = { ...prev, expandedStageIds: nextIds };
        saveFlowState(transactionId, principalId ?? null, next);
        return next;
      });
    },
    [transactionId],
  );

  const setStageEditing = useCallback(
    (stageId: string, editing: boolean): void => {
      setFlowState((prev) => {
        const already = prev.editingStageIds.includes(stageId);
        if (editing === already) return prev;
        const nextIds = editing
          ? [...prev.editingStageIds, stageId]
          : prev.editingStageIds.filter((id) => id !== stageId);
        // Editing implies the card must be expanded so the form is visible.
        const nextExpanded = editing && !prev.expandedStageIds.includes(stageId)
          ? [...prev.expandedStageIds, stageId]
          : prev.expandedStageIds;
        const next = {
          ...prev,
          editingStageIds: nextIds,
          expandedStageIds: nextExpanded,
        };
        saveFlowState(transactionId, principalId ?? null, next);
        return next;
      });
    },
    [transactionId, principalId],
  );

  return {
    transaction,
    userRole,
    stages,
    otherPartyStages,
    activeJourney,
    setActiveJourney,
    providerSelections,
    selectProvider,
    clearProvider,
    rateProvider,
    completeStage,
    totalCostPence,
    propxchainFeePence,
    expandedStageIds: flowState.expandedStageIds,
    toggleStage,
    editingStageIds: flowState.editingStageIds,
    setStageEditing,
    isLoading,
    error,
    chainPersistError,
    invalidationKey,
    bumpInvalidationKey,
    syntheticEvents,
  };
}
