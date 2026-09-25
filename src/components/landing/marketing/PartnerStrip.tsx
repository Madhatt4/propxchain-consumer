// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Working with" — the named providers behind the services a customer orders.
 *
 * Sits high on the page, straight after the audience chooser: a mover
 * recognises these names before they recognise ours, so the reassurance is
 * worth more here than buried further down. It stays *below* the chooser
 * because that is the primary action and should not be pushed down the page.
 *
 * Each mark links out to the partner's own site as a plain follow link. These
 * are integration credits, not paid placements, so no `sponsored` rel.
 */
import { PARTNERS } from './partners';

export function PartnerStrip(): JSX.Element {
  return (
    <section
      id="partners"
      className="section-pad divider-top"
      style={{ background: 'var(--ink2)' }}
      data-screen-label="Partners"
    >
      <div className="wrap">
        <div className="reveal px-partner-head">
          <span className="eyebrow center">Working with</span>
          <h2 className="h-sec">
            Every report has a <span className="key">name on it.</span>
          </h2>
          <p className="px-partner-lead">
            Searches, chain updates and surveys on PropXchain are produced by established
            providers, not by us. Here is who they are.
          </p>
        </div>

        <ul className="px-partner-grid reveal">
          {PARTNERS.map((partner) => (
            <li key={partner.name}>
              <a
                className="card px-partner-card"
                href={partner.href}
                target="_blank"
                rel="noopener"
              >
                <span
                  className={
                    partner.onWhitePlate
                      ? 'px-partner-mark px-partner-mark-plate'
                      : 'px-partner-mark'
                  }
                >
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className={partner.logoOnDark ? 'px-logo-light has-dark' : 'px-logo-light'}
                    loading="lazy"
                  />
                  {partner.logoOnDark ? (
                    <img
                      src={partner.logoOnDark}
                      alt={partner.name}
                      className="px-logo-dark"
                      loading="lazy"
                    />
                  ) : null}
                </span>
                <span className="px-partner-cat">{partner.category}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
