// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The timeline guide leads with one statistic. These tests pin that it stays
 * cited to its source, that the week-by-week table is present and labelled as
 * an illustration, and that the new table and external-link primitives render
 * accessibly.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';

import ConveyancingTimelineGuide from '../ConveyancingTimelineGuide';
import { GuideExternalLink, GuideTable } from '../guideElements';

const renderGuide = (): void => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <ConveyancingTimelineGuide />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

describe('GuideExternalLink', () => {
  it('should open in a new tab without passing the opener or referrer', () => {
    render(<GuideExternalLink href="https://example.org/source">Source</GuideExternalLink>);

    const link = screen.getByRole('link', { name: 'Source' });

    expect(link).toHaveAttribute('href', 'https://example.org/source');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('GuideTable', () => {
  it('should render column headers and one row per entry under an accessible caption', () => {
    render(<GuideTable caption="Example timeline" head={['When', 'What']} rows={[['Week 1', 'Start'], ['Week 2', 'Finish']]} />);

    const table = screen.getByRole('table', { name: 'Example timeline' });

    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['When', 'What']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('should render only the header row when there are no entries', () => {
    render(<GuideTable caption="Empty" head={['When']} rows={[]} />);

    expect(within(screen.getByRole('table', { name: 'Empty' })).getAllByRole('row')).toHaveLength(1);
  });
});

describe('ConveyancingTimelineGuide', () => {
  it('should cite the Rightmove average to its source', () => {
    renderGuide();

    expect(screen.getByText(/167 days, about five and a half months/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rightmove' })).toHaveAttribute(
      'href',
      'https://www.rightmove.co.uk/guides/buyer/buying-a-property/offer-accepted/',
    );
  });

  it('should present the week-by-week table as an illustration', () => {
    renderGuide();

    const table = screen.getByRole('table', { name: /illustrative conveyancing timeline/i });

    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(screen.getByText(/It is not a guarantee/)).toBeInTheDocument();
  });

  it('should answer the searches and Scotland questions people search for', () => {
    renderGuide();

    expect(screen.getByRole('heading', { name: 'How long do conveyancing searches take?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What about Scotland?' })).toBeInTheDocument();
  });
});
