import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockLogout } = vi.hoisted(() => ({ mockLogout: vi.fn() }));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { useAuthStore } from '../../stores/authStore';
import { useAutoLogout } from '../useAutoLogout';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

describe('useAutoLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockLogout.mockReset();
    useAuthStore.setState({ isAuthenticated: false, logout: mockLogout });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should sign out after 15 idle minutes when the user signs in after the hook mounted', () => {
    // App mounts the hook once, before the session is restored.
    renderHook(() => useAutoLogout());

    act(() => {
      useAuthStore.setState({ isAuthenticated: true });
    });
    act(() => {
      vi.advanceTimersByTime(FIFTEEN_MINUTES + 1000);
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('should not sign anyone out while signed out', () => {
    renderHook(() => useAutoLogout());

    act(() => {
      vi.advanceTimersByTime(FIFTEEN_MINUTES * 2);
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('should stop the idle timer after sign-out', () => {
    renderHook(() => useAutoLogout());
    act(() => {
      useAuthStore.setState({ isAuthenticated: true });
    });
    act(() => {
      useAuthStore.setState({ isAuthenticated: false });
    });
    act(() => {
      vi.advanceTimersByTime(FIFTEEN_MINUTES * 2);
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });
});
