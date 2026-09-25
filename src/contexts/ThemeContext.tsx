// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Theme, getTheme, setTheme as setThemeUtil } from '../utils/theme';

/**
 * Theme context value exposed to components
 */
export interface ThemeContextType {
  /** Current theme ('dark' or 'light') */
  theme: Theme;
  /** Set the theme explicitly */
  setTheme: (theme: Theme) => void;
  /** Toggle between dark and light themes */
  toggleTheme: () => void;
  /** Convenience boolean for dark mode */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provider props
 */
interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme if none is stored in localStorage */
  defaultTheme?: Theme;
}

/**
 * Theme Context Provider
 *
 * Provides theme state management across the application, allowing components
 * to react to theme changes in real-time. Persists theme preference to localStorage.
 *
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 *
 * // Use the hook in components
 * const { theme, toggleTheme, isDark } = useTheme();
 * ```
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light'
}) => {
  // Initialize from localStorage or use default
  const [theme, setThemeState] = useState<Theme>(() => {
    // Read synchronously to prevent flash
    if (typeof window !== 'undefined') {
      return getTheme();
    }
    return defaultTheme;
  });

  // Apply theme to document whenever it changes
  useEffect(() => {
    setThemeUtil(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 *
 * @throws Error if used outside of ThemeProvider
 * @returns Theme context value
 *
 * @example
 * ```tsx
 * const { theme, toggleTheme, isDark } = useTheme();
 *
 * return (
 *   <button onClick={toggleTheme}>
 *     {isDark ? 'Switch to Light' : 'Switch to Dark'}
 *   </button>
 * );
 * ```
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
