// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * ThemeToggle - Sun/Moon toggle button for switching between light and dark themes
 *
 * Features animated icon transitions and is fully accessible.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ThemeToggle />
 *
 * // With label
 * <ThemeToggle showLabel />
 *
 * // Small size
 * <ThemeToggle size="sm" />
 * ```
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  size = 'md',
  showLabel = false
}) => {
  const { toggleTheme, isDark } = useTheme();

  // 44px is the floor, not a preference — this is an icon-only control in the
  // shared header, so WCAG 2.5.5 applies with no inline exception. Measured at
  // 32px (sm) in production 2026-07-31. 'sm' and 'md' therefore land on the
  // same size: the small variant simply cannot go below the accessible
  // minimum, and shrinking it further would only make it harder to hit.
  const sizeClasses = {
    sm: 'h-11 w-11',
    md: 'h-11 w-11',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        sizeClasses[size],
        'relative rounded-full transition-colors',
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Sun icon - shown in dark mode (clicking switches to light) */}
      <Sun
        className={cn(
          iconSizes[size],
          'absolute transition-all duration-300',
          isDark
            ? 'rotate-0 scale-100 text-yellow-400'
            : 'rotate-90 scale-0'
        )}
      />
      {/* Moon icon - shown in light mode (clicking switches to dark) */}
      <Moon
        className={cn(
          iconSizes[size],
          'absolute transition-all duration-300',
          isDark
            ? '-rotate-90 scale-0'
            : 'rotate-0 scale-100 text-gray-700'
        )}
      />
      {showLabel && (
        <span className="sr-only">
          {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        </span>
      )}
    </Button>
  );
};

/**
 * ThemeToggleWithLabel - Theme toggle with visible text label
 * Useful for settings pages or where more context is needed
 */
export const ThemeToggleWithLabel: React.FC<{ className?: string }> = ({ className }) => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        'text-gray-700 dark:text-gray-300',
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="text-sm font-medium">
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
};

export default ThemeToggle;
