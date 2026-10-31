import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuoteScopeBlock from '../QuoteScopeBlock';
import {
  SEARCH_SUMMARY_HEADING,
  SEARCH_SUMMARY_NOTICE,
  SEARCH_SUMMARY_TRUNCATED_NOTICE,
  type QuoteScope,
  type SearchSummary,
} from '@/types/quoteScope.types';

const scope: QuoteScope = {
  items: [
    {
      key: 'leasehold_review',
      category: 'supplement',
      title: 'Leasehold — additional legal work',
      detail: 'Review the lease, apportionments, ground rent and service charge.',
      trigger: 'Leasehold',
      provenance: 'HMLR title BD101346, edition 2024-11-02',
      confidence: 'high',
    },
    {
      key: 'flood_insurability_enquiry',
      category: 'enquiry',
      title: 'Flood risk — confirm insurability',
      detail: 'Confirm buildings insurance is available on standard terms.',
      trigger: 'Low',
      provenance: 'Groundsure environmental report, flood section',
      confidence: 'high',
    },
    {
      key: 'boundary_dispute_task',
      category: 'task',
      title: 'Boundary — check for historic dispute',
      detail: 'Check the title register for boundary dispute entries.',
      trigger: 'Boundary feature',
      provenance: 'HMLR title BD101346, boundary section',
      confidence: 'medium',
    },
  ],
  notAvailable: ['Survey scan not yet available'],
  derivedAt: '2026-07-26T10:00:00.000Z',
  schemaVersion: 1,
};

describe('QuoteScopeBlock', () => {
  it('should group items under their category headings', () => {
    render(<QuoteScopeBlock scope={scope} />);
    expect(screen.getByText('Supplements')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Leasehold — additional legal work')).toBeInTheDocument();
    expect(screen.getByText('Boundary — check for historic dispute')).toBeInTheDocument();
  });

  it('should hide canned enquiry items from the firm', () => {
    render(<QuoteScopeBlock scope={scope} />);
    expect(screen.queryByText('Enquiries')).not.toBeInTheDocument();
    expect(screen.queryByText('Flood risk — confirm insurability')).not.toBeInTheDocument();
    expect(screen.queryByText(/Groundsure environmental report/)).not.toBeInTheDocument();
  });

  it('should show provenance for every item so the conveyancer can verify it', () => {
    render(<QuoteScopeBlock scope={scope} />);
    expect(screen.getByText(/HMLR title BD101346, edition 2024-11-02/)).toBeInTheDocument();
    expect(screen.getByText(/HMLR title BD101346, boundary section/)).toBeInTheDocument();
  });

  it('should render the confidence qualifier for non-high confidence items', () => {
    render(<QuoteScopeBlock scope={scope} />);
    expect(screen.getByText(/\(medium confidence\)/)).toBeInTheDocument();
  });

  it('should list what was not available', () => {
    render(<QuoteScopeBlock scope={scope} />);
    expect(screen.getByText(/Survey scan not yet available/)).toBeInTheDocument();
  });

  it('should never render a currency symbol', () => {
    const { container } = render(<QuoteScopeBlock scope={scope} />);
    expect(container.textContent).not.toContain('£');
  });

  it('should render nothing when scope is null', () => {
    const { container } = render(<QuoteScopeBlock scope={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the empty state when there are no items', () => {
    const empty: QuoteScope = { ...scope, items: [] };
    render(<QuoteScopeBlock scope={empty} />);
    expect(screen.getByText(/No scope items were identified/)).toBeInTheDocument();
  });

  it('should render the empty state when the only items are hidden enquiries', () => {
    const onlyEnquiries: QuoteScope = { ...scope, items: [scope.items[1]] };
    render(<QuoteScopeBlock scope={onlyEnquiries} />);
    expect(screen.getByText('Pre-identified Scope')).toBeInTheDocument();
    expect(screen.getByText(/No scope items were identified/)).toBeInTheDocument();
    expect(screen.queryByText('Flood risk — confirm insurability')).not.toBeInTheDocument();
  });

  describe('search summary', () => {
    const searchSummary: SearchSummary = {
      sections: [
        {
          provider: 'OneSearch',
          explainer: 'The search found a planning notice.',
          flags: [
            { statement: 'A planning notice is recorded.', searchName: 'LLC1', location: 'Part 3' },
            { statement: 'A road scheme is listed.', searchName: 'CON29' },
          ],
        },
      ],
      truncated: false,
    };

    it('should render the summary with its labels', () => {
      render(<QuoteScopeBlock scope={{ ...scope, searchSummary }} />);
      expect(screen.getByText(SEARCH_SUMMARY_HEADING)).toBeInTheDocument();
      expect(screen.getByText(SEARCH_SUMMARY_NOTICE)).toBeInTheDocument();
      expect(screen.getByText('OneSearch')).toBeInTheDocument();
      expect(screen.getByText('The search found a planning notice.')).toBeInTheDocument();
      expect(screen.getByText('A planning notice is recorded.')).toBeInTheDocument();
      expect(screen.getByText('LLC1, Part 3')).toBeInTheDocument();
      expect(screen.getByText('CON29')).toBeInTheDocument();
    });

    it('should say when part of the summary was left out', () => {
      render(
        <QuoteScopeBlock scope={{ ...scope, searchSummary: { ...searchSummary, truncated: true } }} />,
      );
      expect(screen.getByText(SEARCH_SUMMARY_TRUNCATED_NOTICE)).toBeInTheDocument();
    });

    it('should not show the truncation notice on a whole summary', () => {
      render(<QuoteScopeBlock scope={{ ...scope, searchSummary }} />);
      expect(screen.queryByText(SEARCH_SUMMARY_TRUNCATED_NOTICE)).not.toBeInTheDocument();
    });

    it('should show the summary alone when there are no other items', () => {
      render(<QuoteScopeBlock scope={{ ...scope, items: [], searchSummary }} />);
      expect(screen.getByText(SEARCH_SUMMARY_HEADING)).toBeInTheDocument();
      expect(screen.queryByText(/No scope items were identified/)).not.toBeInTheDocument();
    });

    it('should show the summary alone when the only items are hidden enquiries', () => {
      render(<QuoteScopeBlock scope={{ ...scope, items: [scope.items[1]], searchSummary }} />);
      expect(screen.getByText(SEARCH_SUMMARY_HEADING)).toBeInTheDocument();
      expect(screen.queryByText(/No scope items were identified/)).not.toBeInTheDocument();
    });

    it('should leave a scope with no summary as it was', () => {
      render(<QuoteScopeBlock scope={scope} />);
      expect(screen.queryByText(SEARCH_SUMMARY_HEADING)).not.toBeInTheDocument();
    });
  });
});
