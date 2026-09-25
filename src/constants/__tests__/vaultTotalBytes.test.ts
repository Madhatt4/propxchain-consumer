import { describe, it, expect } from 'vitest';
import { vaultTotalBytes } from '../subscriptionFeatures';

describe('vaultTotalBytes', () => {
  it('should give starter 250 MB and premium 1 GB', () => {
    expect(vaultTotalBytes('starter')).toBe(250 * 1024 * 1024);
    expect(vaultTotalBytes('premium')).toBe(1024 * 1024 * 1024);
  });
});
