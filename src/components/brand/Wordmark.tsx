// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The PropXchain name set as type: Fraunces, bold, with the X in teal. This is
 * the logo in the signed-in top bar and the landing page's nav and footer.
 * `Logo` (the glass lockup image) is still used on the other public pages.
 *
 * The base colour comes from the caller's `className`, so it follows whatever
 * theme tokens that surface uses; the X's teal is `accentClassName`, which
 * defaults to the brand teal for light and dark mode.
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
    </span>
  );
}

export default Wordmark;
