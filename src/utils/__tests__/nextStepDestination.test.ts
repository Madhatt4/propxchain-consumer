import { describe, it, expect } from 'vitest';
import {
  resolveNextStepDestination,
  type JourneyRole,
  type NextStepAction,
  type ResolvableStage,
} from '../nextStepDestination';

const ALL_ACTIONS: NextStepAction[] = [
  'browse_conveyancer_panel',
  'fetch_hmlr_title',
  'invite_solicitor_by_email',
  'lookup_title_number',
  'send_nudge_message',
  'upload_required_document',
];

const sellerStages = (activeId = 'seller-2'): ResolvableStage[] =>
  ['seller-1', 'seller-2', 'seller-3', 'seller-4', 'seller-5', 'seller-6', 'seller-7'].map((id) => ({
    id,
    status: id === activeId ? 'active' : 'pending',
  }));

const buyerStages = (activeId = 'buyer-2'): ResolvableStage[] =>
  ['buyer-1', 'buyer-2', 'buyer-3', 'buyer-4', 'buyer-5', 'buyer-6', 'buyer-7'].map((id) => ({
    id,
    status: id === activeId ? 'active' : 'pending',
  }));

const stagesFor = (journey: JourneyRole): ResolvableStage[] =>
  journey === 'seller' ? sellerStages() : buyerStages();

describe('resolveNextStepDestination', () => {
  // THE REGRESSION GUARD. The shipped version fell back to a no-op, so four
  // of these six actions were buttons that did nothing when a buyer clicked
  // them. This table is the reason that cannot happen again quietly.
  describe('every action reaches a stage on both journeys', () => {
    const cases = (['seller', 'buyer'] as JourneyRole[]).flatMap((journey) =>
      ALL_ACTIONS.map((action) => ({ journey, action })),
    );

    it.each(cases)('$journey / $action resolves to a real stage', ({ journey, action }) => {
      const stages = stagesFor(journey);
      const result = resolveNextStepDestination(action, journey, stages);

      expect(result).not.toBeNull();
      expect(stages.some((s) => s.id === result?.stageId)).toBe(true);
    });
  });

  describe('precise destinations', () => {
    it.each([
      ['browse_conveyancer_panel', 'seller', 'seller-5'],
      ['browse_conveyancer_panel', 'buyer', 'buyer-5'],
      ['invite_solicitor_by_email', 'seller', 'seller-5'],
      ['invite_solicitor_by_email', 'buyer', 'buyer-5'],
      ['fetch_hmlr_title', 'seller', 'seller-1'],
      ['lookup_title_number', 'seller', 'seller-1'],
      ['upload_required_document', 'seller', 'seller-3'],
    ] as const)('should send %s on the %s journey to %s', (action, journey, expected) => {
      const result = resolveNextStepDestination(action, journey, stagesFor(journey));
      expect(result).toEqual({ stageId: expected, isFallback: false });
    });
  });

  describe('actions with no correct stage answer', () => {
    // These are flagged rather than mapped on purpose. A wrong destination is
    // worse than an admitted-imprecise one.
    it.each([
      ['send_nudge_message', 'seller'],
      ['send_nudge_message', 'buyer'],
      ['fetch_hmlr_title', 'buyer'],
      ['lookup_title_number', 'buyer'],
      ['upload_required_document', 'buyer'],
    ] as const)('should mark %s on the %s journey as a fallback', (action, journey) => {
      const result = resolveNextStepDestination(action, journey, stagesFor(journey));
      expect(result?.isFallback).toBe(true);
    });

    it('should land the fallback on the active stage, not stage one', () => {
      const result = resolveNextStepDestination('send_nudge_message', 'buyer', buyerStages('buyer-4'));
      expect(result).toEqual({ stageId: 'buyer-4', isFallback: true });
    });

    it('should use the first stage when nothing is marked active', () => {
      const stages: ResolvableStage[] = [{ id: 'buyer-1' }, { id: 'buyer-2' }];
      const result = resolveNextStepDestination('send_nudge_message', 'buyer', stages);
      expect(result).toEqual({ stageId: 'buyer-1', isFallback: true });
    });
  });

  describe('edge cases', () => {
    it('should fall back when the precise stage is not visible on this transaction', () => {
      // Some transactions hide stages. Mapping to a stage that is not on
      // screen would scroll to nothing — the original no-op in another guise.
      const stages = sellerStages().filter((s) => s.id !== 'seller-5');
      const result = resolveNextStepDestination('browse_conveyancer_panel', 'seller', stages);

      expect(result?.isFallback).toBe(true);
      expect(result?.stageId).toBe('seller-2');
    });

    it('should fall back rather than throw on an action string it does not know', () => {
      const result = resolveNextStepDestination('some_future_action', 'seller', sellerStages());
      expect(result).toEqual({ stageId: 'seller-2', isFallback: true });
    });

    it('should return null only when there are no stages at all', () => {
      expect(resolveNextStepDestination('browse_conveyancer_panel', 'seller', [])).toBeNull();
    });
  });
});
