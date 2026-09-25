// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Who are you?" — five audience jump cards. Each card scrolls to the matching
 * in-page audience section.
 */

import type { MouseEvent } from 'react';

import { AUDIENCE_CARDS } from './data';

interface AudienceCardsProps {
  onScrollTo: (id: string) => void;
}

export function AudienceCards({ onScrollTo }: AudienceCardsProps): JSX.Element {
  const scroll = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    onScrollTo(id);
  };

  return (
    <section
      id="audiences"
      className="divider-top"
      style={{ padding: '4.5rem 3.5rem', background: 'var(--ink)' }}
      data-screen-label="Audience picker"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">Who are you?</span>
        </div>
        <h2 className="h-sec reveal" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)' }}>
          One transaction. <span className="key">Five seats at the table.</span>
        </h2>

        <div className="px-g5 gap-4 mt-10">
          {AUDIENCE_CARDS.map((card) => (
            <a
              key={card.id}
              href={`#${card.id}`}
              onClick={scroll(card.id)}
              className="card reveal flex flex-col gap-2.5"
              style={{ padding: '1.4rem 1.25rem', color: 'var(--fg)' }}
            >
              <span style={{ fontSize: '1.3rem' }}>{card.glyph}</span>
              <span className="font-display" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {card.name}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--fg-3)', lineHeight: 1.5 }}>{card.line}</span>
              <span
                className="num"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.68rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--t)',
                  marginTop: 'auto',
                }}
              >
                {card.cta} →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
