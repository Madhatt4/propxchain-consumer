// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Unified-landing hero (design option "1b — The chain"). Full-viewport, centred
 * editorial layout with a glass nav, an ambient brand still behind the copy,
 * an animated milestone chain, and a footer
 * stat strip. Unlike the old cinematic hero this one is fully theme-aware — it
 * re-themes with the toggle via the `.px-landing` root tokens.
 */

import { type MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { IS_REGISTRATION_OPEN } from '@/config/registration';
import { liveCategories } from '@/pages/resources/resourcesMeta';

import { MarketingNav } from './MarketingNav';
import { useMilestoneChain } from './hooks/useMilestoneChain';

interface Milestone {
  label: string;
  /** Glyph shown while the node is still pending. */
  pending: string;
}

const MILESTONES: Milestone[] = [
  { label: 'Listed', pending: '·' },
  { label: 'Forms done', pending: '·' },
  { label: 'Searches in', pending: '·' },
  { label: 'Enquiries', pending: '·' },
  { label: 'Exchange', pending: '⧗' },
  { label: 'Complete', pending: '🔑' },
];

interface HeroSectionProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onScrollTo: (id: string) => void;
}

export function HeroSection({ isDark, onToggleTheme, onScrollTo }: HeroSectionProps): JSX.Element {
  const activeIndex = useMilestoneChain();

  const scroll = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    onScrollTo(id);
  };

  // Naming the live pillars keeps the promise the size of the library: the
  // registry is the only place that knows which categories have real articles,
  // so a pillar going live or dark rewords this line rather than stranding it.
  const helpTopics = liveCategories()
    .map((c) => c.name)
    .join(', ');

  // The teal fill spans the six nodes: node centres sit at 8.3% and 91.7%, an
  // 83.4% run, so each completed step advances the line by a fifth of it.
  const lineWidth = `${(Math.min(activeIndex, 5) / 5) * 83.4}%`;

  return (
    <section
      className="relative w-full flex flex-col overflow-hidden"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--ink) 0%, var(--ink2) 100%)',
        transition: 'background 300ms ease-out',
      }}
      data-screen-label="Hero"
    >
      {/* Ambient still behind the copy. Purely decorative, so it carries an
          empty alt and is hidden from assistive tech. One render serves both
          themes — the `.px-hero-loop` opacity token is what adapts it to each
          ground, so there is no per-theme file and nothing to remount on a
          toggle. The filename carries a version suffix because the service
          worker serves static assets cache-first, so a same-URL swap would
          keep serving the stale image.
          v2 crops the left quarter off the source render: it was a flat white
          wall, and `object-cover` faithfully filled a quarter of the hero with
          it. Cropping leaves the frame at 1.32 rather than 16:9, so on a wide
          viewport cover now trims top and bottom instead — which keeps the
          holographic path and the couple, the two things worth showing. */}
      <img
        className="px-hero-loop absolute inset-0 h-full w-full object-cover"
        src="/images/hero-still-v2-2048.webp"
        srcSet="/images/hero-still-v2-1280.webp 1280w, /images/hero-still-v2-2048.webp 2048w"
        sizes="100vw"
        alt=""
        aria-hidden="true"
      />
      <div className="grid-bg absolute inset-0" />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 900,
          height: 500,
          top: -200,
          left: '50%',
          marginLeft: -450,
          borderRadius: 9999,
          filter: 'blur(80px)',
          background: 'radial-gradient(circle, rgba(0,212,184,0.1), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col px-6 md:px-14 pt-6">
        <MarketingNav isDark={isDark} onToggleTheme={onToggleTheme} onScrollTo={onScrollTo} />

        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <span
            className="eyebrow center px-up"
            style={{ marginBottom: '1.8rem', animationDelay: '300ms' }}
          >
            On-chain Property Transactions · England &amp; Wales
          </span>

          <h1
            className="font-display font-black px-up"
            style={{
              color: 'var(--fg)',
              fontSize: 'clamp(2.4rem, 8vw, 5.6rem)',
              letterSpacing: '-0.035em',
              lineHeight: 1,
              margin: '0 0 1.6rem',
              animationDelay: '100ms',
            }}
          >
            Your property. Your deal.
            <br />
            <em style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--t)' }}>Your control.</em>
          </h1>

          <p
            className="px-up"
            style={{
              fontSize: '1.1rem',
              color: 'var(--fg-2)',
              maxWidth: '40rem',
              lineHeight: 1.7,
              margin: '0 0 2.2rem',
              animationDelay: '500ms',
            }}
          >
            Sellers, buyers, conveyancers, developers and agents — one transaction, one ledger, everyone
            watching the same truth.
          </p>

          <div
            className="flex flex-wrap gap-4 justify-center px-up"
            style={{ animationDelay: '800ms' }}
          >
            {/* Once sign-ups are open the account becomes the ask and the
                report drops to a secondary button — it is still the capture
                path for anyone not ready to register. "Find your role" gives
                up its slot rather than run four buttons across the hero; the
                nav still links every audience section. */}
            {IS_REGISTRATION_OPEN ? (
              <>
                <Link to="/register" className="btn-primary px-8 py-3.5">
                  Create your free account
                </Link>
                <a
                  href="#report"
                  onClick={scroll('report')}
                  className="btn-ghost px-8 py-3.5"
                  style={{ borderColor: 'var(--t-30)' }}
                >
                  Get your free report
                </a>
              </>
            ) : (
              <>
                <a href="#report" onClick={scroll('report')} className="btn-primary px-8 py-3.5">
                  Get your free Home Mover Report
                </a>
                <a
                  href="#audiences"
                  onClick={scroll('audiences')}
                  className="btn-ghost px-8 py-3.5"
                  style={{ borderColor: 'var(--t-30)' }}
                >
                  Find your role
                </a>
              </>
            )}
            {/* The one hero CTA that leaves the page, so it routes rather than
                scrolling to an in-page section. */}
            <Link
              to="/resources"
              className="btn-ghost px-8 py-3.5"
              style={{ borderColor: 'var(--t-30)' }}
            >
              Help &amp; Support
            </Link>
          </div>

          <p
            className="px-up"
            style={{
              fontSize: '0.78rem',
              color: 'var(--fg-3)',
              margin: '1.1rem 0 4.5rem',
              maxWidth: '34rem',
              lineHeight: 1.6,
              animationDelay: '900ms',
            }}
          >
            Plain-English guides for every stage of your move &mdash; {helpTopics}.
          </p>

          <div className="px-chain px-up w-full" style={{ maxWidth: 1100, animationDelay: '1100ms' }}>
            <div className="px-chain-grid">
              <div className="px-chain-track" />
              <div className="px-chain-fill" style={{ width: lineWidth }} />
              {MILESTONES.map((ms, i) => {
                const done = i < activeIndex;
                const active = i === activeIndex;
                const state = done ? ' is-done' : active ? ' is-active' : '';
                const glyph = done ? '✓' : active ? '●' : ms.pending;
                return (
                  <div key={ms.label} className="relative flex flex-col items-center gap-2.5">
                    <span className={`px-node${state}`}>{glyph}</span>
                    <span className={`px-node-label${state}`}>{ms.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative z-[2] flex flex-wrap justify-center num"
        style={{
          borderTop: '1px solid var(--border-teal)',
          padding: '1.1rem 3.5rem',
          gap: '1rem 4rem',
          fontSize: '0.72rem',
          color: 'var(--fg-3)',
        }}
      >
        <span><span style={{ color: 'var(--t)' }}>Free</span> platform, for everyone</span>
        <span><span style={{ color: 'var(--t)' }}>↑ £2,000</span> typical saving</span>
        <span><span style={{ color: 'var(--t)' }}>AI co-pilot</span> premium tier — coming soon</span>
      </div>
    </section>
  );
}
