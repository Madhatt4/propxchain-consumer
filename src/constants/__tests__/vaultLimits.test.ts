import { describe, it, expect } from 'vitest';
import { VAULT_CAPS } from '../vaultLimits';

describe('VAULT_CAPS', () => {
  it('should give every user 30 files per slot and 1 GB in total', () => {
    // Arrange / Act: the platform is free, so there is one set of limits.
    const { maxFilesPerSlot, maxTotalBytes } = VAULT_CAPS;

    // Assert
    expect(maxFilesPerSlot).toBe(30);
    expect(maxTotalBytes).toBe(1024 * 1024 * 1024);
  });
});
