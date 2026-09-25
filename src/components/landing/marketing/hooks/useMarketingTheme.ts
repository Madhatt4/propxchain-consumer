// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Marketing-only theme controller. Drives `data-theme` on <html> and persists
 * to localStorage['px-theme']. Deliberately independent of the app-wide
 * `.dark` ThemeProvider (which the dashboard relies on): the landing re-themes
 * via scoped CSS variables.
 *
 * The landing defaults to light; the toggle still switches it and a returning
 * visitor keeps whichever mode they last chose. That default lives in two
 * places which must agree — here, and the inline no-flash script in
 * index.html that applies the saved attribute before React mounts.
 */

import { useCallback, useEffect, useState } from 'react';

export type MarketingTheme = 'dark' | 'light';

const STORAGE_KEY = 'px-theme';

function readStoredTheme(): MarketingTheme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 'light';
}

export interface MarketingThemeController {
  theme: MarketingTheme;
  isDark: boolean;
  toggleTheme: () => void;
}

export function useMarketingTheme(): MarketingThemeController {
  const [theme, setThemeState] = useState<MarketingTheme>(readStoredTheme);

  // Keep <html> and storage in sync whenever the theme changes.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failures (private mode etc.) */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, isDark: theme === 'dark', toggleTheme };
}
