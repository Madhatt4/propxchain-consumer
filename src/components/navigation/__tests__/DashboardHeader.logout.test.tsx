// The header's Sign out used to clear only the in-memory store, so on a shared
// computer the persisted Supabase session signed the account back in on the
// next load and the last user's deal drafts stayed in the browser. These tests
// run the real store logout behind the button and mock only its outer seams.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockSignOut, mockIcpLogout } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockIcpLogout: vi.fn(),
}));

vi.mock('../../../services/supabase.auth.service', () => ({
  supabaseAuthService: { signOut: () => mockSignOut() },
}));

vi.mock('../../../services/icp.service', () => ({
  icpService: { logout: () => mockIcpLogout(), initialize: vi.fn() },
}));

vi.mock('../../../services/message.service', () => ({
  messageService: { reinitialize: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../services/devicePushToken.service', () => ({
  removeDevicePushToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../common/NotificationBell', () => ({ default: () => null }));
vi.mock('../../common/RateLimitIndicator', () => ({ default: () => null }));

import DashboardHeader from '../DashboardHeader';
import { useAuthStore } from '@/stores/authStore';

const originalLocation = window.location;

function renderHeader(): void {
  render(
    <MemoryRouter>
      <DashboardHeader user={{ firstName: 'Test', lastName: 'User' }} />
    </MemoryRouter>,
  );
}

describe('DashboardHeader sign out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockIcpLogout.mockResolvedValue(undefined);
    localStorage.clear();
    // @ts-expect-error jsdom's location cannot be assigned without replacing it
    delete window.location;
    // @ts-expect-error a plain object stands in so the redirect can be read back
    window.location = { ...originalLocation, href: '' };
    useAuthStore.setState({
      isAuthenticated: true, authMethod: 'supabase', principal: null, principalId: 'p-1',
      supabaseUser: null, isLoading: false, error: null,
    });
  });

  afterEach(() => {
    // @ts-expect-error restoring the real location replaced in beforeEach
    window.location = originalLocation;
  });

  it('should end the Supabase session when Logout is clicked', async () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().principalId).toBeNull();
  });

  it('should clear deal drafts and legacy wizard data from the browser', async () => {
    localStorage.setItem('ta6_tx_1', '{"draft":true}');
    localStorage.setItem('ta10_tx_1', '{"draft":true}');
    localStorage.setItem('wizardData', '{"address":"1 Test Street"}');
    localStorage.setItem('unrelated_pref', 'kept');
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(window.location.href).toBe('/'));
    expect(localStorage.getItem('ta6_tx_1')).toBeNull();
    expect(localStorage.getItem('ta10_tx_1')).toBeNull();
    expect(localStorage.getItem('wizardData')).toBeNull();
    expect(localStorage.getItem('unrelated_pref')).toBe('kept');
  });

  it('should send the user to the home page only after the session has ended', async () => {
    let finishSignOut: () => void = () => undefined;
    mockSignOut.mockImplementation(
      () => new Promise<void>((resolve) => { finishSignOut = resolve; }),
    );
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(window.location.href).toBe('');

    finishSignOut();
    await waitFor(() => expect(window.location.href).toBe('/'));
  });
});
