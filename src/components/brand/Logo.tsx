// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The PropXchain glass lockup image. The signed-in top bar and the landing
 * page use the type-set `Wordmark` instead; this stays on the other pages.
 *
 * The lockup is the glass render — house, wordmark and tagline together on its
 * own dark ground — so it reads as a self-contained tile rather than a
 * transparent glyph. Both variants resolve to the same asset:
 *
 * - `variant="full"` — roomy surfaces (footers, auth screens, centred headers).
 * - `variant="mark"` — tight top-nav bars, collapsed sidebars, avatars.
 *
 * Because the tile carries its own background, it no longer needs a per-surface
 * colour treatment. `tone` survives for the ~20 existing call sites and now
 * controls the edge only: `onLight` adds a hairline ring so the dark tile has a
 * defined edge against cream/white, `onDark` leaves it flush.
 *
 * The wordmark inside the tile is part of the artwork, so a caller placing this
 * next to a separate "PropXchain" text label would render the name twice.
 *
 * The ® is an SVG overlay in the artwork's own 930x768 coordinates, so it sits
 * just after the baked-in wordmark at every size. PropXchain is a registered
 * UK trade mark, UK00004420719 (Class 42), registered 2026-10-09.
 */
import { Link } from 'react-router-dom';

import lockupGlass from '@/assets/brand/propxchain-lockup-glass.webp';

/** Where the wordmark ends in the lockup artwork, in its pixel coordinates. */
const LOCKUP_SIZE = { width: 930, height: 768 } as const;
const REGISTERED_MARK = { x: 810, y: 532, size: 52 } as const;

export type LogoVariant = 'full' | 'mark';
export type LogoTone = 'onLight' | 'onDark';

interface LogoProps {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Tailwind sizing/colour classes for the <img>. Default keeps aspect ratio. */
  className?: string;
  /** Router destination. Pass `null` to render the image without a link. */
  to?: string | null;
  alt?: string;
}

export function Logo({
  variant = 'full',
  tone = 'onLight',
  className = 'h-8 w-auto',
  to = '/',
  alt = 'PropXchain',
}: LogoProps): JSX.Element {
  // The tile is deliberately soft-cornered; `full` gets a slightly larger radius
  // because it is only ever rendered at footer/hero sizes.
  const radius = variant === 'full' ? 'rounded-lg' : 'rounded-md';
  const edge = tone === 'onLight' ? ' ring-1 ring-black/10' : '';

  const image = (
    <span className="relative inline-block">
      <img
        src={lockupGlass}
        alt={alt}
        className={`${radius} object-contain${edge} ${className}`.trim()}
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${LOCKUP_SIZE.width} ${LOCKUP_SIZE.height}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
        data-testid="registered-mark"
      >
        <text
          x={REGISTERED_MARK.x}
          y={REGISTERED_MARK.y}
          fontSize={REGISTERED_MARK.size}
          fill="#E6FBFF"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          ®
        </text>
      </svg>
    </span>
  );

  if (to === null) {
    return image;
  }

  return (
    <Link to={to} aria-label={alt} className="inline-flex items-center">
      {image}
    </Link>
  );
}

export default Logo;
