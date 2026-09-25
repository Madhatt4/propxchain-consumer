// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Session Management Utility
 * Provides secure session management with timeout enforcement using sessionStorage
 *
 * Security Features:
 * - Session data stored in sessionStorage (auto-clears on browser close)
 * - Configurable session timeout (default: 20 minutes, matches useAutoLogout)
 * - Automatic expiry checking on all session reads
 * - Thread-safe session operations
 *
 * @example
 * ```typescript
 * const sessionManager = SessionManager.getInstance();
 *
 * // Set session after successful login
 * sessionManager.setSession({
 *   principalId: 'abc123',
 *   isAuthenticated: true
 * });
 *
 * // Check if session is valid
 * if (sessionManager.isSessionValid()) {
 *   const data = sessionManager.getSessionData();
 *   logger.info('User principal:', data?.principalId);
 * } else {
 *   // Redirect to login
 * }
 *
 * // Clear session on logout
 * sessionManager.clearSession();
 * ```
 */

import { logger } from './logger';

/**
 * Session data structure
 */
export interface SessionData {
  principalId: string;
  isAuthenticated: boolean;
  csrfToken?: string;
  userType?: string;
}

/**
 * Session storage keys (centralized to prevent typos)
 */
const SESSION_KEYS = {
  PRINCIPAL_ID: 'principalId',
  IS_AUTHENTICATED: 'isAuthenticated',
  SESSION_EXPIRY: 'sessionExpiry',
  CSRF_TOKEN: 'csrfToken',
  USER_TYPE: 'userType',
} as const;

/**
 * Session configuration
 */
interface SessionConfig {
  /** Session timeout duration in milliseconds (default: 20 minutes) */
  timeoutMs: number;
  /** Whether to auto-refresh session on activity (default: true) */
  autoRefresh: boolean;
}

/**
 * Default session configuration
 * Absolute session timeout: 24 hours (matches II delegation)
 * Idle timeout is handled separately by useAutoLogout hook (15 minutes)
 */
const DEFAULT_CONFIG: SessionConfig = {
  timeoutMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds (matches II delegation)
  autoRefresh: true,
};

/**
 * Session Manager
 * Singleton class for managing user sessions with timeout enforcement
 */
export class SessionManager {
  private static instance: SessionManager | null = null;
  private config: SessionConfig;

  /**
   * Private constructor (use getInstance() instead)
   */
  private constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance of SessionManager
   */
  public static getInstance(config: Partial<SessionConfig> = {}): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(config);
    }
    return SessionManager.instance;
  }

  /**
   * Set session data with automatic expiry timestamp
   *
   * @param data - Session data to store
   * @param customTimeoutMs - Optional custom timeout (overrides default)
   */
  public setSession(data: SessionData, customTimeoutMs?: number): void {
    try {
      const timeoutMs = customTimeoutMs ?? this.config.timeoutMs;
      const expiryTimestamp = Date.now() + timeoutMs;

      // Store session data in sessionStorage
      sessionStorage.setItem(SESSION_KEYS.PRINCIPAL_ID, data.principalId);
      sessionStorage.setItem(SESSION_KEYS.IS_AUTHENTICATED, String(data.isAuthenticated));
      sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, String(expiryTimestamp));

      // Store optional fields
      if (data.csrfToken) {
        sessionStorage.setItem(SESSION_KEYS.CSRF_TOKEN, data.csrfToken);
      }
      if (data.userType) {
        sessionStorage.setItem(SESSION_KEYS.USER_TYPE, data.userType);
      }

      logger.info('✅ Session created successfully (expires in', timeoutMs / 1000 / 60, 'minutes)');
    } catch (error) {
      logger.error('❌ Failed to set session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Check if current session is valid (exists and not expired)
   *
   * @returns True if session is valid, false otherwise
   */
  public isSessionValid(): boolean {
    try {
      const expiry = sessionStorage.getItem(SESSION_KEYS.SESSION_EXPIRY);
      const isAuthenticated = sessionStorage.getItem(SESSION_KEYS.IS_AUTHENTICATED);
      const principalId = sessionStorage.getItem(SESSION_KEYS.PRINCIPAL_ID);

      // Session must have all required fields
      if (!expiry || !isAuthenticated || !principalId) {
        return false;
      }

      // Check if session has expired
      const expiryTimestamp = parseInt(expiry, 10);
      const now = Date.now();

      if (now > expiryTimestamp) {
        logger.info('⏰ Session expired, clearing session data');
        this.clearSession();
        return false;
      }

      // Auto-refresh session timeout on activity (if enabled)
      if (this.config.autoRefresh) {
        this.refreshSessionTimeout();
      }

      return isAuthenticated === 'true';
    } catch (error) {
      logger.error('❌ Error checking session validity:', error);
      return false;
    }
  }

  /**
   * Get current session data
   *
   * @returns Session data or null if session is invalid
   */
  public getSessionData(): SessionData | null {
    if (!this.isSessionValid()) {
      return null;
    }

    try {
      const principalId = sessionStorage.getItem(SESSION_KEYS.PRINCIPAL_ID);
      const isAuthenticated = sessionStorage.getItem(SESSION_KEYS.IS_AUTHENTICATED) === 'true';
      const csrfToken = sessionStorage.getItem(SESSION_KEYS.CSRF_TOKEN) || undefined;
      const userType = sessionStorage.getItem(SESSION_KEYS.USER_TYPE) || undefined;

      if (!principalId) {
        return null;
      }

      return {
        principalId,
        isAuthenticated,
        csrfToken,
        userType,
      };
    } catch (error) {
      logger.error('❌ Error retrieving session data:', error);
      return null;
    }
  }

  /**
   * Get remaining session time in milliseconds
   *
   * @returns Remaining time in ms, or 0 if session is invalid
   */
  public getRemainingSessionTime(): number {
    try {
      const expiry = sessionStorage.getItem(SESSION_KEYS.SESSION_EXPIRY);
      if (!expiry) {
        return 0;
      }

      const expiryTimestamp = parseInt(expiry, 10);
      const remaining = Math.max(0, expiryTimestamp - Date.now());
      return remaining;
    } catch (error) {
      logger.error('❌ Error calculating remaining session time:', error);
      return 0;
    }
  }

  /**
   * Refresh session timeout (extend session by timeout duration)
   * Used to keep sessions alive during user activity
   */
  public refreshSessionTimeout(): void {
    try {
      const isAuthenticated = sessionStorage.getItem(SESSION_KEYS.IS_AUTHENTICATED);
      const principalId = sessionStorage.getItem(SESSION_KEYS.PRINCIPAL_ID);

      if (!isAuthenticated || !principalId) {
        return; // No active session to refresh
      }

      const newExpiryTimestamp = Date.now() + this.config.timeoutMs;
      sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, String(newExpiryTimestamp));
    } catch (error) {
      logger.error('❌ Error refreshing session timeout:', error);
    }
  }

  /**
   * Update CSRF token in active session
   *
   * @param token - New CSRF token
   */
  public updateCsrfToken(token: string): void {
    if (!this.isSessionValid()) {
      logger.warn('⚠️ Cannot update CSRF token: session is invalid');
      return;
    }

    try {
      sessionStorage.setItem(SESSION_KEYS.CSRF_TOKEN, token);
      logger.info('✅ CSRF token updated');
    } catch (error) {
      logger.error('❌ Error updating CSRF token:', error);
    }
  }

  /**
   * Clear all session data
   * Should be called on logout or session expiry
   */
  public clearSession(): void {
    try {
      // Remove all session-related keys
      sessionStorage.removeItem(SESSION_KEYS.PRINCIPAL_ID);
      sessionStorage.removeItem(SESSION_KEYS.IS_AUTHENTICATED);
      sessionStorage.removeItem(SESSION_KEYS.SESSION_EXPIRY);
      sessionStorage.removeItem(SESSION_KEYS.CSRF_TOKEN);
      sessionStorage.removeItem(SESSION_KEYS.USER_TYPE);

      logger.info('🧹 Session cleared successfully');
    } catch (error) {
      logger.error('❌ Error clearing session:', error);
    }
  }

  /**
   * Get principal ID from session (convenience method)
   *
   * @returns Principal ID or null if session is invalid
   */
  public getPrincipalId(): string | null {
    const sessionData = this.getSessionData();
    return sessionData?.principalId ?? null;
  }

  /**
   * Get CSRF token from session (convenience method)
   *
   * @returns CSRF token or null if not available
   */
  public getCsrfToken(): string | null {
    const sessionData = this.getSessionData();
    return sessionData?.csrfToken ?? null;
  }

  /**
   * Check if user is authenticated (convenience method)
   *
   * @returns True if authenticated and session is valid
   */
  public isAuthenticated(): boolean {
    const sessionData = this.getSessionData();
    return sessionData?.isAuthenticated ?? false;
  }

  /**
   * Configure session manager settings
   *
   * @param config - Partial configuration to update
   */
  public configure(config: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('⚙️ Session manager configured:', this.config);
  }

  /**
   * Get current configuration
   *
   * @returns Current session configuration
   */
  public getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Reset singleton instance (useful for testing)
   * WARNING: This will clear the current instance - use with caution
   */
  public static resetInstance(): void {
    SessionManager.instance = null;
  }
}

/**
 * Export singleton instance for convenient imports
 */
export const sessionManager = SessionManager.getInstance();

/**
 * Export session timeout constant for reference
 */
export const SESSION_TIMEOUT_MS = DEFAULT_CONFIG.timeoutMs;
