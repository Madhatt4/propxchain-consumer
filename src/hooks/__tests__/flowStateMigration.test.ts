import { describe, it, expect } from 'vitest';
import { migrateFlowState } from '../useTransactionFlow';
import type { TransactionFlowState } from '../../types/flow.types';

describe('migrateFlowState — localStorage format upgrade', () => {
  it('leaves a fresh default state unchanged', () => {
    const fresh: TransactionFlowState = {
      activeJourney: 'seller',
      userPreferredJourney: null,
      providerSelections: {},
      completedStages: {},
      expandedStageIds: [],
      editingStageIds: [],
    };
    expect(migrateFlowState(fresh)).toEqual(fresh);
  });

  it('upgrades a v1 state (expandedStageId: string) to v2 (expandedStageIds: [string])', () => {
    const v1 = {
      activeJourney: 'seller',
      providerSelections: {},
      completedStages: {},
      expandedStageId: 'seller-2',
    };
    const upgraded = migrateFlowState(v1 as unknown as TransactionFlowState);
    expect(upgraded.expandedStageIds).toEqual(['seller-2']);
    expect('expandedStageId' in upgraded).toBe(false);
  });

  it('upgrades a v1 state with null expandedStageId to an empty array', () => {
    const v1 = {
      activeJourney: 'seller',
      providerSelections: {},
      completedStages: {},
      expandedStageId: null,
    };
    const upgraded = migrateFlowState(v1 as unknown as TransactionFlowState);
    expect(upgraded.expandedStageIds).toEqual([]);
  });

  it('leaves a v2 state alone (idempotent)', () => {
    const v2: TransactionFlowState = {
      activeJourney: 'buyer',
      userPreferredJourney: null,
      providerSelections: {},
      completedStages: {},
      expandedStageIds: ['seller-2', 'seller-5'],
      editingStageIds: [],
    };
    expect(migrateFlowState(v2)).toEqual(v2);
  });

  it('preserves an explicit userPreferredJourney across migration', () => {
    const v3: TransactionFlowState = {
      activeJourney: 'buyer',
      userPreferredJourney: 'buyer',
      providerSelections: {},
      completedStages: {},
      expandedStageIds: [],
      editingStageIds: [],
    };
    expect(migrateFlowState(v3)).toEqual(v3);
  });

  it('treats a pre-userPreferredJourney v2 state as having no explicit preference', () => {
    // Before the field existed, every stored activeJourney was the
    // derived default from the original mount — never an explicit toggle.
    // Migration sets userPreferredJourney to null so the next mount
    // re-derives instead of locking in the stale default.
    const legacy = {
      activeJourney: 'seller',
      providerSelections: {},
      completedStages: {},
      expandedStageIds: [],
      editingStageIds: [],
    };
    const upgraded = migrateFlowState(legacy);
    expect(upgraded.userPreferredJourney).toBeNull();
  });
});
