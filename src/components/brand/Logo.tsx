// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The PropXchain logo for every page outside the landing hero: the type-set
 * `Wordmark` (Fraunces, bold, teal X) with the registered trade mark sign.
 * It replaced the glass lockup image so the whole site carries the same logo
 * as the landing page, top and bottom. Keeping this component, rather than
 * importing `Wordmark` at each of the ~20 call sites, means a page cannot
 * drift back to an older mark.
 *
 * - `variant="full"` — roomy surfaces (footers, auth screens): a larger size.
 * - `variant="mark"` — top bars, sidebars and compact headers.
 *
 * Callers size the box with height classes (`h-9`, `h-11`); the text is
 * vertically centred inside it. `tone` picks the base colour for the
 * surface: `onDark` is white, `onLight` is near-black and follows the app's
 * dark mode.
 *
 * PropXchain is a registered UK trade mark, UK00004420719 (Class 42),
 * registered 2026-10-09, hence the ®.
 */
import { Link } from 'react-router-dom';

import { Wordmark } from './Wordmark';

export type LogoVariant = 'full' | 'mark';
export type LogoTone = 'onLight' | 'onDark';

interface LogoProps {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Box sizing classes, e.g. `h-9 w-auto`. */
  className?: string;
  /** Router destination. Pass `null` to render the logo without a link. */
  to?: string | null;
  alt?: string;
}

const SIZE: Record<LogoVariant, string> = {
  full: 'text-[1.75rem]',
  mark: 'text-[1.5rem]',
};

const COLOUR: Record<LogoTone, string> = {
  onLight: 'text-[#1A1A1A] dark:text-[#E5E7EB]',
  onDark: 'text-white',
};

export function Logo({
  variant = 'full',
  tone = 'onLight',
  className = 'h-8 w-auto',
  to = '/',
  alt = 'PropXchain',
}: LogoProps): JSX.Element {
  const logo = (
    <span role="img" aria-label={alt} className={`inline-flex items-center ${className}`.trim()}>
      <Wordmark className={`${SIZE[variant]} ${COLOUR[tone]}`} />
      <sup
        aria-hidden="true"
        data-testid="registered-mark"
        className={`ml-0.5 text-[0.55rem] font-sans ${COLOUR[tone]}`}
      >
        ®
      </sup>
    </span>
  );

  if (to === null) {
    return logo;
  }

  return (
    <Link to={to} aria-label={alt} className="inline-flex items-center">
      {logo}
    </Link>
  );
}

export default Logo;
