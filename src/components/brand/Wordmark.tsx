// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The PropXchain name set as type: Fraunces, bold, with the X in teal. This is
 * the logo in the landing page's nav and footer, and `Logo` wraps it (with
 * the ® sign) for every other page.
 *
 * The base colour comes from the caller's `className`, so it follows whatever
 * theme tokens that surface uses; the X's teal is `accentClassName`, which
 * defaults to the brand teal for light and dark mode.
 *
 * PropXchain is a registered UK trade mark, UK00004420719 (Class 42),
 * registered 2026-10-09, so the wordmark always carries the ® sign. It is
 * hidden from screen readers so the name is still read as "PropXchain".
 */

interface WordmarkProps {
  /** Size and base colour, e.g. `text-[22px] text-[var(--text-main)]`. */
  className?: string;
  accentClassName?: string;
}

export function Wordmark({
  className = '',
  accentClassName = 'text-[#0D9488] dark:text-[#00D4B8]',
}: WordmarkProps): JSX.Element {
  return (
    <span className={`font-display font-bold leading-none tracking-[-0.02em] ${className}`.trim()}>
      Prop<span className={accentClassName}>X</span>chain
      <sup aria-hidden="true" data-testid="registered-mark" className="ml-[0.08em] align-super text-[0.4em] font-sans font-normal">
        ®
      </sup>
    </span>
  );
}

export default Wordmark;
