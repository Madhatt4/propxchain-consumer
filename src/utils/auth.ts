import { icpService } from '../services/icp.service';
import { logger } from '@/utils/logger';
import { useAuthStore, getStorePrincipalId, getStoreIsAuthenticated } from '../stores/authStore';

// Authentication utility functions
// RFC 9700: principalId + isAuthenticated live in Zustand only — never localStorage.
// Full-page reload forces re-auth via authStore.initialize().
export const authUtils = {
  // Check if user is authenticated
  isAuthenticated: (): boolean => getStoreIsAuthenticated(),

  // Get current user principal
  getCurrentPrincipal: (): string | null => getStorePrincipalId(),

  // Get current user - DEPRECATED: Use canister call instead
  getCurrentUser: (): Record<string, unknown> | null => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      logger.warn('Reading user data from localStorage is deprecated. Fetch from canister instead.');
      try {
        return JSON.parse(userStr) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    const principalId = getStorePrincipalId();
    if (principalId) {
      return { principal: principalId };
    }
    return null;
  },

  // Get auth token - DEPRECATED: Use Internet Identity delegation
  getToken: (): string | null => {
    logger.warn('SECURITY WARNING: getToken() is deprecated. Use Internet Identity authentication.');
    return getStorePrincipalId();
  },

  // Set authentication data — pushes principal into Zustand (no localStorage).
  setAuthData: (principalId: string): void => {
    useAuthStore.setState({ principalId, isAuthenticated: true });
  },

  // Clear authentication data — clears Zustand auth state and legacy LS keys.
  clearAuthData: (): void => {
    useAuthStore.setState({
      isAuthenticated: false,
      principalId: null,
      principal: null,
    });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('wizardData');
    localStorage.removeItem('currentPhase');
    localStorage.removeItem('completedPhases');
    localStorage.removeItem('wizardSaves');
  },

  // Logout (with ICP service integration)
  logout: async (): Promise<void> => {
    authUtils.clearAuthData();
    window.location.href = '/';
    icpService.logout().catch(error => {
      logger.error('Error logging out from ICP:', error);
    });
  },

  // Check if session is valid (Internet Identity based)
  isSessionValid: async (): Promise<boolean> => {
    try {
      if (!authUtils.isAuthenticated()) {
        return false;
      }
      const isValid = await icpService.checkAuthStatus();
      if (!isValid) {
        authUtils.clearAuthData();
      }
      return isValid;
    } catch (error) {
      logger.error('Error checking session validity:', error);
      return false;
    }
  },

  // Check if token is expired - DEPRECATED: Use isSessionValid()
  isTokenExpired: (): boolean => {
    logger.warn('SECURITY WARNING: isTokenExpired() is deprecated. Use isSessionValid() instead.');
    return !authUtils.isAuthenticated();
  }
};
