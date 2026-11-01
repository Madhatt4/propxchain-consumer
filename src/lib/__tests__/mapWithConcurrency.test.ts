import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../mapWithConcurrency';

describe('mapWithConcurrency', () => {
  it('should never run more than the limit at once', async () => {
    // Arrange
    let running = 0;
    let peak = 0;
    const slowCall = async (item: number): Promise<number> => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
      return item;
    };

    // Act
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, slowCall);

    // Assert
    expect(peak).toBe(4);
  });

  it('should keep input order when later items finish first', async () => {
    const results = await mapWithConcurrency([30, 1, 10], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms * 2;
    });

    expect(results).toEqual([60, 2, 20]);
  });

  it('should return an empty list for no items', async () => {
    expect(await mapWithConcurrency([], 4, async (item: number) => item)).toEqual([]);
  });

  it('should reject when a call fails', async () => {
    const failing = mapWithConcurrency([1], 2, async () => {
      throw new Error('canister refused');
    });

    await expect(failing).rejects.toThrow('canister refused');
  });
});
