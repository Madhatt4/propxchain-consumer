// Sign-out must drop every in-memory trace of the previous user. The sidebar
// and top bar navigate to /login without a page reload, so anything a
// singleton still holds (the decrypted ICP key, the messaging agent, cached
// queries) would otherwise sign the next visitor's calls as the last user.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIcpLogout, mockReinitialize, mockQueryClear, mockSignOut } = vi.hoisted(() => ({
  mockIcpLogout: vi.fn(),
  mockReinitialize: vi.fn(),
  mockQueryClear: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('../../services/icp.service', () => ({
  icpService: { logout: () => mockIcpLogout(), initialize: vi.fn() },
}));

vi.mock('../../services/message.service', () => ({
  messageService: { reinitialize: () => mockReinitialize() },
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: { clear: () => mockQueryClear() },
}));

vi.mock('../../services/supabase.auth.service', () => ({
  supabaseAuthService: { signOut: () => mockSignOut() },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useAuthStore } from '../authStore';

describe('authStore.logout resets per-user singletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIcpLogout.mockResolvedValue(undefined);
    mockReinitialize.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true, authMethod: 'supabase', principal: null, principalId: 'p-1',
      supabaseUser: null, isLoading: false, error: null,
    });
  });

  it('should log the ICP service out so the previous key stops signing calls', async () => {
    await useAuthStore.getState().logout();

    expect(mockIcpLogout).toHaveBeenCalledTimes(1);
  });

  it('should reset the messaging service and clear cached queries', async () => {
    await useAuthStore.getState().logout();

    expect(mockReinitialize).toHaveBeenCalledTimes(1);
    expect(mockQueryClear).toHaveBeenCalledTimes(1);
  });

  it('should still clear local auth state when resetting a service fails', async () => {
    mockIcpLogout.mockRejectedValue(new Error('canister unreachable'));

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().principalId).toBeNull();
  });
});
