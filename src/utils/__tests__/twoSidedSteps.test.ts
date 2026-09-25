import { describe, it, expect } from 'vitest';
import { isWaitingForOtherSide } from '../twoSidedSteps';

describe('isWaitingForOtherSide', () => {
  it('should recognise the canister reply to the first side of a two-sided step', () => {
    expect(isWaitingForOtherSide('Completion confirmed for the buyer side. Waiting for the seller side.')).toBe(true);
    expect(isWaitingForOtherSide('Exchange signed for the seller side. Waiting for the buyer side.')).toBe(true);
  });

  it('should treat the completing reply and errors as not waiting', () => {
    expect(isWaitingForOtherSide('Blockchain completion initiated and executed: done')).toBe(false);
    expect(isWaitingForOtherSide('Contract exchange recorded successfully')).toBe(false);
    expect(isWaitingForOtherSide('')).toBe(false);
    expect(isWaitingForOtherSide(undefined)).toBe(false);
  });
});
