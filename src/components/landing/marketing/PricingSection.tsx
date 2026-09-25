// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Pricing" — Starter (Free, featured) / Premium (£75, coming soon) /
 * Enterprise (Custom).
 *
 * A tier CTA routes when it has a destination it can honour, and otherwise
 * scrolls to the report/notify section. Starter's '/register' is the one that
 * moves: while sign-ups are closed the /register route renders a "not yet"
 * notice, so offering it would be the offer-and-destination mismatch
 * config/registration.ts exists to prevent.
 */

import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { IS_REGISTRATION_OPEN } from '@/config/registration';

import { PRICING_TIERS, type PricingTier } from './data';

/** Resolves a tier CTA to a route, or undefined to scroll to the report. */
function tierCtaPath(tier: PricingTier): string | undefined {
  if (!tier.ctaPath) return undefined;
  if (tier.ctaPath === '/register' && !IS_REGISTRATION_OPEN) return undefined;
  return tier.ctaPath;
}

interface PricingSectionProps {
  onScrollTo: (id: string) => void;
}

export function PricingSection({ onScrollTo }: PricingSectionProps): JSX.Element {
  const scroll = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    onScrollTo(id);
  };

  return (
    <section
      id="pricing"
      className="section-pad divider-top"
      style={{ background: 'var(--ink2)' }}
      data-screen-label="Pricing"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">Pricing</span>
        </div>
        <h2 className="h-sec reveal">
          One flat fee. <span className="key">No percentages.</span>
        </h2>

        <div className="px-g3 gap-5 mt-12 items-stretch">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`card reveal flex flex-col relative${tier.featured ? ' card-teal' : ''}`}
              style={{ padding: '1.9rem', ...(tier.featured ? { borderColor: 'var(--t)' } : {}) }}
            >
              {tier.featured && (
                <span
                  className="num"
                  style={{
                    position: 'absolute',
                    top: '-0.7rem',
                    left: '1.9rem',
                    background: 'var(--t)',
                    color: 'var(--t-ink)',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.62rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '0.25rem 0.7rem',
                    borderRadius: 9999,
                    fontWeight: 600,
                  }}
                >
                  Popular
                </span>
              )}
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0, color: 'var(--fg)' }}>
                {tier.name}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--fg-3)', lineHeight: 1.6, margin: '0.5rem 0 1.25rem' }}>
                {tier.sub}
              </p>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="num" style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--t)' }}>
                  {tier.price}
                </span>
                {tier.priceNote && <span style={{ fontSize: '0.78rem', color: 'var(--fg-3)' }}>{tier.priceNote}</span>}
              </div>
              <div className="flex flex-col gap-2.5 flex-1 mb-6">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex gap-2.5 items-baseline">
                    <span style={{ color: 'var(--t)', fontSize: '0.8rem' }}>✓</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--fg-2)' }}>{feature}</span>
                  </div>
                ))}
              </div>
              {tierCtaPath(tier) ? (
                <Link
                  to={tierCtaPath(tier) as string}
                  className={`${tier.featured ? 'btn-primary' : 'btn-ghost'} py-3 text-sm`}
                  style={tier.featured ? undefined : { borderColor: 'var(--t)', color: 'var(--t)' }}
                >
                  {tier.ctaLabel}
                </Link>
              ) : (
                <a
                  href="#report"
                  onClick={scroll('report')}
                  className={`${tier.featured ? 'btn-primary' : 'btn-ghost'} py-3 text-sm`}
                  style={tier.featured ? undefined : { borderColor: 'var(--t)', color: 'var(--t)' }}
                >
                  {tier.ctaLabel}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
