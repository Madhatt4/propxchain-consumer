// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Glass navigation bar for the unified landing. Every audience link scrolls to
 * its in-page section — there are no separate audience routes. "Log in" opens
 * the sign-in card over the page rather than routing away (it stays a <Link>,
 * so middle-click still opens /?signin=1 in a working new tab). The primary CTA
 * routes to a real page once sign-ups are open: it offers the report capture
 * while registration is closed and an account once it is not, so the button
 * never sends anyone to a page that turns them away.
 *
 * Below the `md` breakpoint the inline links collapse into a hamburger menu.
 * The dropdown is rendered as a sibling of <nav> (not a child) because the
 * `liquid-glass` nav has `overflow: hidden`, which would clip a panel below it.
 */

import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '@/components/brand/Logo';
import { SIGN_IN_URL } from '@/components/auth/SignInDialog';
import { IS_REGISTRATION_OPEN } from '@/config/registration';

import { NAV_LINKS } from './data';

interface MarketingNavProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onScrollTo: (id: string) => void;
}

export function MarketingNav({ isDark, onToggleTheme, onScrollTo }: MarketingNavProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  const scroll = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    onScrollTo(id);
  };

  const linkCls = 'text-sm hover:text-[color:var(--t)] transition-colors';

  return (
    <div className="relative">
      <nav className="liquid-glass rounded-md px-5 py-3 flex items-center justify-between gap-6">
        <Logo variant="mark" tone={isDark ? 'onDark' : 'onLight'} to="/" className="h-12 w-auto" />

        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={scroll(link.id)}
              className={linkCls}
              style={{ color: 'var(--fg-2)' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleTheme}
            className="theme-toggle"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Switch theme"
          >
            <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>

          {/* Desktop-only actions — on mobile these move into the dropdown. The
              breakpoint toggle lives on wrapper spans because `.px-landing .btn-primary`
              forces `display:inline-flex` and would beat Tailwind's `hidden`. */}
          <Link to={SIGN_IN_URL} className="hidden md:inline text-sm" style={{ color: 'var(--fg-2)' }}>
            <span className={linkCls}>Log in</span>
          </Link>
          <span className="hidden md:inline-flex">
            {/* min-h-11 (44px): this is the nav's primary CTA and py-2 alone
                left it at 36px. items-center keeps the label optically centred. */}
            {IS_REGISTRATION_OPEN ? (
              <Link to="/register" className="btn-primary px-5 py-2 text-sm min-h-11 items-center">
                Create account
              </Link>
            ) : (
              <a
                href="#report"
                onClick={scroll('report')}
                className="btn-primary px-5 py-2 text-sm min-h-11 items-center"
              >
                Free report
              </a>
            )}
          </span>

          <span className="inline-flex md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="theme-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="marketing-mobile-menu"
              title="Menu"
            >
              <svg style={{ width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M3 6h18M3 12h18M3 18h18'} />
              </svg>
            </button>
          </span>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="marketing-mobile-menu"
          style={{ position: 'absolute' }}
          className="liquid-glass rounded-md left-0 right-0 top-full mt-2 px-5 py-5 flex flex-col gap-4 md:hidden z-40"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={scroll(link.id)}
              className="text-base hover:text-[color:var(--t)] transition-colors"
              style={{ color: 'var(--fg-2)' }}
            >
              {link.label}
            </a>
          ))}
          <Link
            to={SIGN_IN_URL}
            onClick={() => setMenuOpen(false)}
            className="text-base hover:text-[color:var(--t)] transition-colors"
            style={{ color: 'var(--fg-2)' }}
          >
            Log in
          </Link>
          {IS_REGISTRATION_OPEN ? (
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="btn-primary px-5 py-3 text-sm text-center mt-1"
            >
              Create account
            </Link>
          ) : (
            <a href="#report" onClick={scroll('report')} className="btn-primary px-5 py-3 text-sm text-center mt-1">
              Get your free report
            </a>
          )}
        </div>
      )}
    </div>
  );
}
