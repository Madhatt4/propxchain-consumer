// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PartnerStrip } from '../PartnerStrip';
import { PARTNERS } from '../partners';

/**
 * The strip credits named third parties, so the risky failures are legal ones
 * rather than visual: a mark shown without a link back, a link that leaks the
 * opener, or a partner silently dropped from the list. Each is asserted here.
 *
 * The links are deliberately plain follow — these are integration credits, not
 * paid placements — so a `nofollow`/`sponsored` creeping in is also a failure.
 */
describe('landing partner strip', () => {
  it('should render one outbound card per partner', () => {
    render(<PartnerStrip />);

    expect(screen.getAllByRole('link')).toHaveLength(PARTNERS.length);
  });

  it('should link each partner mark to that partner own site', () => {
    render(<PartnerStrip />);

    for (const partner of PARTNERS) {
      // The accessible name is the mark's alt plus the category label
      // ("tmGroup Searches"), so match on the name rather than equal it.
      const link = screen.getByRole('link', { name: new RegExp(partner.name, 'i') });
      expect(link).toHaveAttribute('href', partner.href);
    }
  });

  it('should open partner links in a new tab without leaking the opener', () => {
    render(<PartnerStrip />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('should not mark partner links as sponsored or nofollow', () => {
    render(<PartnerStrip />);

    for (const link of screen.getAllByRole('link')) {
      const rel = link.getAttribute('rel') ?? '';
      expect(rel).not.toContain('sponsored');
      expect(rel).not.toContain('nofollow');
    }
  });

  it('should name every partner in its alt text so the credit is readable', () => {
    render(<PartnerStrip />);

    for (const partner of PARTNERS) {
      expect(screen.getAllByAltText(partner.name).length).toBeGreaterThan(0);
    }
  });

  it('should state what each partner supplies alongside the mark', () => {
    render(<PartnerStrip />);

    for (const partner of PARTNERS) {
      expect(screen.getAllByText(partner.category).length).toBeGreaterThan(0);
    }
  });
});
