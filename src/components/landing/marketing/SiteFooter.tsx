// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Unified-landing footer — a single row: wordmark · in-page scroll links
 * (plus Help & Support, Privacy and Terms) · copyright line. Sits inside
 * `.px-landing`, so it re-themes with the page.
 */

import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { NAV_LINKS } from './data';

interface SiteFooterProps {
  onScrollTo: (id: string) => void;
}

export function SiteFooter({ onScrollTo }: SiteFooterProps): JSX.Element {
  const scroll = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    onScrollTo(id);
  };

  const linkCls = 'hover:text-[color:var(--t)] transition-colors';
  const linkStyle = { fontSize: '0.8rem', color: 'var(--fg-3)' };

  return (
    <footer
      className="divider-top"
      style={{ padding: '3rem 3.5rem', background: 'var(--ink2)', borderTop: '1px solid var(--card-border)' }}
    >
      <div className="wrap flex flex-wrap items-center justify-between gap-6">
        <span className="font-display" style={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--fg)' }}>
          Prop<span style={{ color: 'var(--t)' }}>X</span>chain
        </span>

        <div className="flex flex-wrap gap-6">
          {NAV_LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`} onClick={scroll(link.id)} className={linkCls} style={linkStyle}>
              {link.label}
            </a>
          ))}
          <Link to="/resources" className={linkCls} style={linkStyle}>Help &amp; Support</Link>
          <Link to="/privacy" className={linkCls} style={linkStyle}>Privacy</Link>
          <Link to="/terms" className={linkCls} style={linkStyle}>Terms</Link>
        </div>

        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '0.65rem',
            letterSpacing: '0.06em',
            color: 'var(--fg-3)',
          }}
        >
          © 2026 PropXchain Ltd · England &amp; Wales · VAT GB 524 6852 77
        </span>
      </div>
    </footer>
  );
}
