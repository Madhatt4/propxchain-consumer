import type { JourneyRole } from './stage.types';
import type { ProviderSelection } from './provider.types';

export interface TransactionFlowState {
  activeJourney: JourneyRole;
  /** User-explicit journey preference (set by the journey toggle, when one
   *  exists). `null` means "no preference — derive from the user's role in
   *  the transaction every time". Without this, the loaded `activeJourney`
   *  becomes a self-fulfilling default: principalId hydrates as null on
   *  first mount, `deriveUserRole` returns the 'seller' fallback, that
   *  value is persisted, and subsequent mounts respect the stored value
   *  as if the user had chosen it. */
  userPreferredJourney: JourneyRole | null;
  providerSelections: Record<string, ProviderSelection>;
  completedStages: Record<string, number>; // stageId → completedAt timestamp
  expandedStageIds: string[];
  /** Stages the user has re-opened for editing after they were completed.
   *  Local-only (never persisted to chain) — purely transient UI state.
   *  When a stage id is in this array, its card renders the input form
   *  again with current values pre-filled instead of the completed badge. */
  editingStageIds: string[];
}
