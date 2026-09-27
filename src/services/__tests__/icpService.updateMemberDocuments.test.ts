import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: (): string | null => null,
  getStoreIsAuthenticated: (): boolean => false,
}));

import { icpService } from '../icp.service';

// Document progress never recorded for email users: the CSRF token was only
// fetched on Internet Identity login, so requireCsrfToken() always threw.
type Privates = { userManagementActor: Record<string, unknown> | null };

describe('icpService.updateMemberDocuments', () => {
  const updateMemberDocuments = vi.fn();
  const generateCSRFToken = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    updateMemberDocuments.mockReset().mockResolvedValue(true);
    generateCSRFToken.mockReset().mockResolvedValue('fresh-token');
    (icpService as unknown as Privates).userManagementActor = { updateMemberDocuments, generateCSRFToken };
  });

  it('should mint a CSRF token when the session has none and record the document', async () => {
    const ok = await icpService.updateMemberDocuments('tx_1785191790114007638', 'proofOfFunds');

    expect(ok).toBe(true);
    expect(generateCSRFToken).toHaveBeenCalledTimes(1);
    expect(updateMemberDocuments).toHaveBeenCalledWith('tx_1785191790114007638', 'proofOfFunds', 'fresh-token');
  });
});
