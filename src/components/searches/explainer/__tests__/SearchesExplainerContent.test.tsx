import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SearchesExplainerContent from '../SearchesExplainerContent';
import type { ExplainerModel } from '../searchExplainerModel';
import { getSearchTypeById } from '@/utils/searchTypes';
import type { SearchType } from '@/types/searches';

function typeOf(id: string): SearchType {
  const searchType = getSearchTypeById(id);
  if (!searchType) throw new Error(`fixture references unknown search type: ${id}`);
  return searchType;
}

const MODEL: ExplainerModel = {
  required: [
    {
      searchType: typeOf('local-authority-search'),
      reason: 'Required for all property transactions',
      priority: 'required',
      confidence: 'high',
      hedged: false,
    },
  ],
  recommended: [
    {
      searchType: typeOf('chancel-repair'),
      reason: 'Historic parish nearby',
      priority: 'recommended',
      confidence: 'low',
      hedged: true,
    },
  ],
  notNeeded: [typeOf('tin-mining')],
};

function renderContent(
  props: Partial<React.ComponentProps<typeof SearchesExplainerContent>> = {},
) {
  return render(
    <MemoryRouter>
      <SearchesExplainerContent
        model={MODEL}
        localAuthorityName="Central Bedfordshire"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('SearchesExplainerContent', () => {
  it('should render a required search with its reason', () => {
    renderContent();
    expect(screen.getByText(/Local Authority Search/)).toBeInTheDocument();
    expect(screen.getByText(/Required for all property transactions/)).toBeInTheDocument();
  });

  it('should render the not-needed group', () => {
    renderContent();
    expect(screen.getByText(/Tin Mining Search/)).toBeInTheDocument();
  });

  it('should name the local authority in the not-needed heading', () => {
    renderContent();
    expect(screen.getByText(/Not usually ordered in Central Bedfordshire/)).toBeInTheDocument();
  });

  it('should prefix a hedged entry so the claim stays tentative', () => {
    renderContent();
    expect(screen.getByText(/Possibly relevant/)).toBeInTheDocument();
  });

  it('should render fully when narration is absent', () => {
    renderContent({ narration: undefined });
    expect(screen.getByText(/Local Authority Search/)).toBeInTheDocument();
  });

  it('should render narration paragraphs when supplied', () => {
    renderContent({ narration: ['A first paragraph.', 'A second paragraph.'] });
    expect(screen.getByText('A first paragraph.')).toBeInTheDocument();
    expect(screen.getByText('A second paragraph.')).toBeInTheDocument();
  });

  it('should never tell the customer what they need', () => {
    const { container } = renderContent();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('you need');
    expect(text).not.toContain("you don't need");
    expect(text).not.toContain('you do not need');
  });

  it('should state plainly that OneSearch per-item prices are unpublished', () => {
    renderContent();
    expect(screen.getByText(/does not publish per-item prices/i)).toBeInTheDocument();
  });

  it('should name OneSearch and tmGroup as the source of the core pack', () => {
    renderContent();
    expect(screen.getByText(/come from OneSearch\s+or tmGroup/i)).toBeInTheDocument();
  });

  it('should say Groundsure supply extras individually, not local authority searches', () => {
    // Groundsure's catalogue is environmental, geo, planning, flood and
    // regional mining. They do not sell LLC1 or CON29, and at launch they are
    // add-on singles rather than a pack — so the card must not imply either.
    renderContent();
    expect(
      screen.getByText(/do not carry out local authority searches/i),
    ).toBeInTheDocument();
  });

  it('should not distinguish CON29M from CON29 by accident', () => {
    // CON29M (coal) is a Groundsure product; CON29 (local authority) is not.
    // Guards against a copy edit that drops the M and makes the card wrong.
    const { container } = renderContent();
    expect(container.textContent).toContain('CON29M coal report');
  });

  it('should show no bundle comparison while the contents mapping is empty', () => {
    const { container } = renderContent();
    expect(container.textContent).not.toMatch(/bought individually/);
  });

  it('should link to the guide', () => {
    renderContent();
    expect(screen.getByRole('link', { name: /what each search/i })).toHaveAttribute(
      'href',
      '/resources/searches-and-legal/property-searches-explained',
    );
  });
});
