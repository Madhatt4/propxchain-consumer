// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

import { Logo } from '@/components/brand/Logo';

/**
 * Marketing nav header — used by MarketingShell only.
 *
 * Same nav on every marketing page. No conditional rendering, no
 * page-specific tweaks. If you find yourself adding props, fork it.
 */
const MarketingHeader: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="w-full border-b border-[#E5E7EB] dark:border-[#1E293B] bg-[#FAFAF8] dark:bg-[#0B1120] transition-colors">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
        <Link
          to="/"
          aria-label="PropXchain"
          className="inline-flex items-center gap-2 font-[Fraunces] text-xl font-semibold tracking-tight text-[#1A1A1A] dark:text-[#E5E7EB] hover:text-[#0D9488]"
        >
          <Logo variant="mark" tone={isDark ? 'onDark' : 'onLight'} to={null} className="h-9 w-auto" />
        </Link>
        <nav className="flex items-center gap-6 font-[DM_Sans] text-sm">
          <Link
            to="/resources"
            className="text-[#1A1A1A] dark:text-[#CBD5E1] hover:text-[#0D9488]"
          >
            Help &amp; Support
          </Link>
          <Link
            to="/#developers"
            className="text-[#1A1A1A] dark:text-[#CBD5E1] hover:text-[#0D9488]"
          >
            For developers
          </Link>
          <Link
            to="/#conveyancers"
            className="text-[#1A1A1A] dark:text-[#CBD5E1] hover:text-[#0D9488]"
          >
            For conveyancers
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-md text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#E5E7EB] dark:hover:bg-[#1E293B] transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <Link
            to="/login"
            className="rounded-md border border-[#0D9488] px-4 py-2 text-[#0D9488] hover:bg-[#0D9488] hover:text-white transition-colors"
          >
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default MarketingHeader;
