// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "How it works" — six step cards (glyph + number row), 3-column grid.
 */

import { STEPS } from './data';

export function HowItWorksSection(): JSX.Element {
  return (
    <section
      id="how"
      className="section-pad divider-top"
      style={{ background: 'var(--ink)' }}
      data-screen-label="How it works"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">How it works</span>
        </div>
        <h2 className="h-sec reveal">
          Six steps. <span className="key">You drive.</span>
        </h2>

        <div className="px-g3 gap-5 mt-12">
          {STEPS.map((step) => (
            <div key={step.num} className="card reveal" style={{ padding: '1.6rem' }}>
              <div className="flex items-center gap-2.5 mb-3.5">
                <span style={{ fontSize: '1.15rem' }}>{step.glyph}</span>
                <span className="num" style={{ fontSize: '0.7rem', color: 'var(--t)', letterSpacing: '0.08em' }}>
                  {step.num}
                </span>
              </div>
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: '1.15rem', margin: '0 0 0.5rem', color: 'var(--fg)' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--fg-2)', lineHeight: 1.65, margin: 0 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
