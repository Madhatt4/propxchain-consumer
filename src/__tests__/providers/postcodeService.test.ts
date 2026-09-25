import { describe, it, expect } from 'vitest';
import { calculateDistanceMiles } from '../../services/postcodeService';

describe('calculateDistanceMiles', () => {
  it('should return 0 for the same point', () => {
    const distance = calculateDistanceMiles(51.5074, -0.1278, 51.5074, -0.1278);
    expect(distance).toBe(0);
  });

  it('should return approximately 50 miles for London to Bedford', () => {
    // London: 51.5074, -0.1278
    // Bedford: 52.1356, -0.4685
    const distance = calculateDistanceMiles(51.5074, -0.1278, 52.1356, -0.4685);

    // London to Bedford is roughly 50 miles; allow a tolerance of +/- 5 miles
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(55);
  });

  it('should be symmetrical (A to B equals B to A)', () => {
    const ab = calculateDistanceMiles(51.5074, -0.1278, 52.1356, -0.4685);
    const ba = calculateDistanceMiles(52.1356, -0.4685, 51.5074, -0.1278);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
