// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Panel partners shown on the landing page.
 *
 * Commercial partners appear here once written permission to use their mark is
 * in hand — an unlicensed logo implies an endorsement we do not have.
 *
 * Permission log — kept deliberately free of individual names and contact
 * details, because this repo flips to public AGPL at Phase 4. The named
 * approver and the email thread for each entry live in the private records.
 * - View My Chain — permission granted 2026-09-10; logo supplied and
 *   link to viewmychain.com approved.
 * - tmGroup — permission granted 2026-09-10; logos and brand guidelines
 *   supplied, link to tmgroup.co.uk approved.
 * - Optimus — permission granted 2026-09-22; FY26 logo pack (positive and
 *   negative) supplied, link to optimus-move.co.uk requested in the ask.
 * Awaiting: Groundsure, OneSearch.
 *
 * HM Land Registry is the exception and is NOT covered by the above. It was
 * added 2026-09-11 on the founder's explicit instruction, without written
 * permission from HMLR. Their Conditions of Use 3.1.7 bars using their data
 * "to represent to the public that You have an arrangement or official
 * partnership with HM Land Registry", and the commercial Standard Terms 21.1
 * bar any use "that suggests any official status or that We endorse You".
 * Recorded here so this reads as a decision taken with the risk known, not as
 * an oversight — and so it is easy to find and pull if HMLR ever object.
 */
import hmlrLogo from '@/assets/brand/partners/hmlr-logo.png';
import optimusLogoOnDark from '@/assets/brand/partners/optimus-logo-on-dark.svg';
import optimusLogo from '@/assets/brand/partners/optimus-logo.svg';
import tmGroupLogoOnDark from '@/assets/brand/partners/tmgroup-logo-on-dark.png';
import tmGroupLogo from '@/assets/brand/partners/tmgroup-logo.png';
import vmcLogo from '@/assets/brand/partners/vmc-logo.png';

export type PartnerCategory = 'Searches' | 'Chain' | 'Surveys' | 'Title';

export interface Partner {
  /** Trading name, also used as the image alt text. */
  name: string;
  /** What they supply, shown under the mark so the credit is specific. */
  category: PartnerCategory;
  /** Mark for light backgrounds. */
  logo: string;
  /**
   * Mark for the dark theme. Omit when `logo` reads on both — a full-colour
   * transparent mark usually does; anything with dark ink or a dark plate does not.
   */
  logoOnDark?: string;
  /** Partner's own site. A plain follow link: these are integration credits, not paid placements. */
  href: string;
  /**
   * Set when the supplied file carries a solid white background rather than
   * transparency. Renders it on a white rounded plate so it reads as a
   * deliberate chip on the dark theme instead of a bare white rectangle.
   */
  onWhitePlate?: boolean;
}

export const PARTNERS: Partner[] = [
  {
    name: 'tmGroup',
    category: 'Searches',
    // The pack's colour wordmark sets "Group" in white, so it only works on
    // dark. Light uses the pack's black wordmark instead.
    logo: tmGroupLogo,
    logoOnDark: tmGroupLogoOnDark,
    href: 'https://www.tmgroup.co.uk/',
  },
  {
    name: 'HM Land Registry',
    category: 'Title',
    // Supplied on a solid white background, so it needs the plate.
    logo: hmlrLogo,
    onWhitePlate: true,
    href: 'https://www.gov.uk/government/organisations/land-registry',
  },
  {
    name: 'View My Chain',
    category: 'Chain',
    logo: vmcLogo,
    href: 'https://viewmychain.com/',
  },
  {
    name: 'Optimus',
    category: 'Surveys',
    // The pack's positive mark has dark-grey ink, which vanishes on the dark
    // theme; the negative one swaps it for white and keeps the orange dot.
    logo: optimusLogo,
    logoOnDark: optimusLogoOnDark,
    href: 'https://optimus-move.co.uk/',
  },
];
