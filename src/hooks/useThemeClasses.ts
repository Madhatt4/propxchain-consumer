import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';

/**
 * Reactive wrapper around getThemeClasses.
 * Re-renders the component when the theme toggles.
 */
export const useThemeClasses = (): ReturnType<typeof getThemeClasses> => {
  const { theme } = useTheme();
  return useMemo(() => getThemeClasses(theme), [theme]);
};
