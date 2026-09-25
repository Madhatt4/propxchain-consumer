// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Security & trust" — six feature cards; the AI guide card is teal-highlighted.
 */

import { FEATURES } from './data';

export function SecuritySection(): JSX.Element {
  return (
    <section
      id="security"
      className="section-pad divider-top"
      style={{ background: 'var(--ink)' }}
      data-screen-label="Security"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">Security &amp; trust</span>
        </div>
        <h2 className="h-sec reveal">
          Every action. On-chain. <span className="key">In real time.</span>
        </h2>

        <div className="px-g3 gap-5 mt-12">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`card reveal${feature.teal ? ' card-teal' : ''}`}
              style={{ padding: '1.6rem' }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '0.9rem' }}>{feature.glyph}</div>
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--fg)' }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--fg-2)', lineHeight: 1.65, margin: 0 }}>{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
