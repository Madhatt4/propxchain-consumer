import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { logger } from '@/utils/logger';

// Idle timeout: 15 minutes (financial/legal services standard)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
// Warning shown 2 minutes before idle logout
export const WARNING_TIME = 2 * 60 * 1000;
// Absolute session max: 24 hours (force re-auth regardless of activity)
const ABSOLUTE_SESSION_MAX_MS = 24 * 60 * 60 * 1000;
// Tab hidden threshold: if tab hidden for 5+ min, show warning on return
const TAB_HIDDEN_THRESHOLD_MS = 5 * 60 * 1000;
// localStorage key for absolute session start
const SESSION_START_KEY = 'propxchain-session-start';

export const useAutoLogout = (): {
  resetTimer: () => void;
  extendSession: () => void;
  showWarning: boolean;
  timeRemaining: number;
  getTimeUntilLogout: () => number;
  getLastActivityTime: () => number;
} => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const absoluteCheckRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const tabHiddenAtRef = useRef<number | null>(null);
  const showWarningRef = useRef(false);

  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(WARNING_TIME);

  const logout = useAuthStore((state) => state.logout);

  // Keep ref in sync with state
  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (absoluteCheckRef.current) {
      clearInterval(absoluteCheckRef.current);
      absoluteCheckRef.current = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    logger.info('Auto-logout: Session expired');
    setShowWarning(false);
    localStorage.removeItem(SESSION_START_KEY);
    logout();
  }, [logout]);

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    const logoutTime = lastActivityRef.current + IDLE_TIMEOUT_MS;
    setTimeRemaining(Math.max(0, logoutTime - Date.now()));

    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, logoutTime - Date.now());
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);
  }, []);

  /** Check if 24-hour absolute session has expired */
  const checkAbsoluteExpiry = useCallback((): boolean => {
    const sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      // First check — record session start
      localStorage.setItem(SESSION_START_KEY, String(Date.now()));
      return false;
    }
    const elapsed = Date.now() - parseInt(sessionStart, 10);
    if (elapsed >= ABSOLUTE_SESSION_MAX_MS) {
      logger.info('Auto-logout: Absolute 24-hour session limit reached');
      performLogout();
      return true;
    }
    return false;
  }, [performLogout]);

  const resetTimer = useCallback(() => {
    // Always check absolute expiry first
    if (checkAbsoluteExpiry()) return;

    clearAllTimers();
    setShowWarning(false);
    setTimeRemaining(WARNING_TIME);

    lastActivityRef.current = Date.now();

    // Warning timer: fires 2 min before idle logout
    const warningDelay = IDLE_TIMEOUT_MS - WARNING_TIME;
    warningTimeoutRef.current = setTimeout(() => {
      logger.info('Auto-logout: Warning - session will expire in 2 minutes');
      setShowWarning(true);
      startCountdown();
    }, warningDelay);

    // Idle logout timer
    timeoutRef.current = setTimeout(() => {
      performLogout();
    }, IDLE_TIMEOUT_MS);

    // Periodic absolute session check (every 60s)
    absoluteCheckRef.current = setInterval(() => {
      checkAbsoluteExpiry();
    }, 60 * 1000);
  }, [clearAllTimers, startCountdown, performLogout, checkAbsoluteExpiry]);

  const extendSession = useCallback(() => {
    logger.info('Auto-logout: Session extended by user');
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      return;
    }

    // Record session start if not already set
    if (!localStorage.getItem(SESSION_START_KEY)) {
      localStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }

    // --- Activity listeners ---
    const handleActivity = (): void => {
      if (!showWarningRef.current) {
        resetTimer();
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // --- Tab visibility detection ---
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now();
      } else {
        // Tab became visible again
        if (tabHiddenAtRef.current) {
          const hiddenDuration = Date.now() - tabHiddenAtRef.current;
          tabHiddenAtRef.current = null;

          // Check absolute expiry on return
          if (checkAbsoluteExpiry()) return;

          // If hidden for 5+ min, show warning immediately
          if (hiddenDuration >= TAB_HIDDEN_THRESHOLD_MS) {
            logger.info(`Auto-logout: Tab was hidden for ${Math.round(hiddenDuration / 1000 / 60)} minutes`);

            // Check if idle timeout already passed while hidden
            const idleTime = Date.now() - lastActivityRef.current;
            if (idleTime >= IDLE_TIMEOUT_MS) {
              performLogout();
              return;
            }

            // Show warning if close to expiry
            if (idleTime >= IDLE_TIMEOUT_MS - WARNING_TIME) {
              setShowWarning(true);
              startCountdown();
              return;
            }

            // Otherwise show warning to re-engage
            setShowWarning(true);
            startCountdown();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start timers
    resetTimer();

    return () => {
      clearAllTimers();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    resetTimer,
    extendSession,
    showWarning,
    timeRemaining,
    getTimeUntilLogout: () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      return Math.max(0, IDLE_TIMEOUT_MS - timeSinceLastActivity);
    },
    getLastActivityTime: () => lastActivityRef.current
  };
};
