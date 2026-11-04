// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Know the property" — the homepage's pointer to the free property check.
 * The check itself lives at /property-check, where it needs no email and
 * Google can index it. This card used to hold a name-and-email form in front
 * of the same report, which gated the one thing a visitor would come for. The
 * section keeps the id `report` because the hero, pricing card and the
 * pre-launch capture path all scroll here.
 *
 * The narrated seller promo video stays in the card. It is a repo asset
 * (`/videos/propxchain-seller-promo-v2.mp4`) with a poster frame and
 * `preload="none"` so it costs nothing until played. It is rendered from an
 * HTML timeline outside this repo (propxchain-media/seller-promo). Each re-cut
 * ships under a new versioned filename so browser caches never serve the old
 * cut.
 */

import { Link } from 'react-router-dom';

export function FreeReportSection(): JSX.Element {
  return (
    <section id="report" className="section-pad divider-top" style={{ background: 'var(--ink)' }} data-screen-label="Free report">
      <div className="wrap sec-inner">
        <div className="liquid-glass rounded-xl px-6 py-12 md:px-14 reveal">
          <div className="text-center mb-10">
            <span className="eyebrow center mb-5">Free property check</span>
            <h2
              className="font-display font-black text-white mt-4"
              style={{ fontSize: 'clamp(2rem,4vw,3.2rem)', lineHeight: 1.05, letterSpacing: '-0.03em' }}
            >
              Know the property before you commit.
            </h2>
            <p className="lead mx-auto" style={{ textAlign: 'center', marginTop: '1.2rem' }}>
              Flood risk, planning history, sold prices, energy rating and heritage status for any address
              in England. Pulled live from official sources, free, in seconds. No sign-up needed.
            </p>
          </div>

          <div className="flex justify-center mb-12">
            <Link to="/property-check" className="btn-primary px-12 py-4 text-base font-semibold min-h-14 items-center">
              Check a property free
            </Link>
          </div>

          <div className="max-w-3xl mx-auto text-center">
            <p className="font-micro uppercase text-[0.65rem] tracking-[0.12em] text-white/60 mb-2.5">
              Watch the 52-second tour
            </p>
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl">
              <video
                className="w-full block aspect-video bg-black"
                controls
                preload="none"
                playsInline
                poster="/videos/propxchain-seller-promo-v2-poster.jpg"
              >
                <source src="/videos/propxchain-seller-promo-v2.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <p className="text-xs text-white/50 mt-2.5">
              Selling? Fill in your details, pull your title, answer the TA forms and invite everyone with one code.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
