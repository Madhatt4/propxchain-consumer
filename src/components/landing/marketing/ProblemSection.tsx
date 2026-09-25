// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "The problem" — eyebrow, headline, three stat cards (teal Geist Mono numbers).
 */

import { PROBLEM_STATS } from './data';

export function ProblemSection(): JSX.Element {
  return (
    <section
      className="section-pad divider-top"
      style={{ background: 'var(--ink2)' }}
      data-screen-label="Problem"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">The problem</span>
        </div>
        <h2 className="h-sec reveal">
          UK conveyancing is <span className="key">broken by design.</span>
        </h2>
        <p className="lead reveal" style={{ marginTop: '1.25rem' }}>
          Not broken by accident — designed for the people charging you to use it. The numbers tell the story.
        </p>

        <div className="px-g3 gap-5 mt-12">
          {PROBLEM_STATS.map((stat) => (
            <div key={stat.label} className="card reveal" style={{ padding: '1.75rem' }}>
              <div className="num" style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--t)', lineHeight: 1 }}>
                {stat.value}
                {stat.sup && <sup style={{ fontSize: '1.2rem' }}>{stat.sup}</sup>}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: '0.68rem',
                  color: 'var(--fg-2)',
                  marginTop: '0.7rem',
                }}
              >
                {stat.label}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--fg-3)', lineHeight: 1.65, margin: '0.8rem 0 0' }}>
                {stat.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
