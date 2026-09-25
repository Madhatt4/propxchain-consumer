// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Shared two-column audience section: emoji eyebrow → Fraunces H2 with an
 * italic teal key phrase → lead → ✓ points → CTA(s), paired with a supporting
 * visual card. `sideFirst` places the visual on the left (0.9fr / 1.1fr).
 */

import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface AudienceCta {
  label: string;
  variant: 'primary' | 'ghost';
  /** Route to navigate to (e.g. "/partners"). Takes precedence over `target`. */
  to?: string;
  /** Section id to scroll to (defaults to the report form). */
  target?: string;
}

interface AudienceSectionProps {
  id: string;
  /** Alternating section background. */
  background: 'ink' | 'ink2';
  eyebrow: string;
  titleLead: string;
  titleKey: string;
  lead: string;
  points: string[];
  ctas: AudienceCta[];
  /** The supporting visual (card or image). */
  side: ReactNode;
  /** Render the visual on the left and copy on the right. */
  sideFirst?: boolean;
  onScrollTo: (id: string) => void;
}

export function AudienceSection({
  id,
  background,
  eyebrow,
  titleLead,
  titleKey,
  lead,
  points,
  ctas,
  side,
  sideFirst = false,
  onScrollTo,
}: AudienceSectionProps): JSX.Element {
  const scroll = (target: string) => (e: MouseEvent) => {
    e.preventDefault();
    onScrollTo(target);
  };

  const copy = (
    <div>
      <div className="reveal">
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <h2 className="h-sec reveal" style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.8rem)', lineHeight: 1.08 }}>
        {titleLead} <span className="key">{titleKey}</span>
      </h2>
      <p className="lead reveal" style={{ maxWidth: '34rem', fontSize: '1rem', margin: '1.1rem 0 1.75rem' }}>
        {lead}
      </p>
      <div className="flex flex-col gap-3.5 mb-8">
        {points.map((point) => (
          <div key={point} className="reveal flex gap-3 items-baseline">
            <span style={{ color: 'var(--t)' }}>✓</span>
            <span style={{ fontSize: '0.92rem', color: 'var(--fg-2)' }}>{point}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {ctas.map((cta) => {
          const cls = `${cta.variant === 'primary' ? 'btn-primary' : 'btn-ghost'} px-7 py-3`;
          const style = cta.variant === 'ghost' ? { borderColor: 'var(--t)' } : undefined;
          // A routed CTA (e.g. the partner form) navigates to a real page;
          // otherwise the CTA smooth-scrolls to an in-page section.
          return cta.to ? (
            <Link key={cta.label} to={cta.to} className={cls} style={style}>
              {cta.label}
            </Link>
          ) : (
            <a
              key={cta.label}
              href={`#${cta.target ?? 'report'}`}
              onClick={scroll(cta.target ?? 'report')}
              className={cls}
              style={style}
            >
              {cta.label}
            </a>
          );
        })}
      </div>
    </div>
  );

  const visual = <div className="reveal">{side}</div>;

  return (
    <section
      id={id}
      className="section-pad divider-top"
      style={{ background: `var(--${background})` }}
      data-screen-label={id}
    >
      <div className={`wrap ${sideFirst ? 'px-cols-rev' : 'px-cols'} items-center`} style={{ gap: '4rem' }}>
        {sideFirst ? (
          <>
            {visual}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {visual}
          </>
        )}
      </div>
    </section>
  );
}
