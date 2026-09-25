import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuoteScopeBlock from '../QuoteScopeBlock';
import type { QuoteScope } from '@/types/quoteScope.types';

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
    expect(screen.getByText('Enquiries')).toBeInTheDocument();
    expect(screen.getByText('Leasehold — additional legal work')).toBeInTheDocument();
    expect(screen.getByText('Flood risk — confirm insurability')).toBeInTheDocument();
  });

  it('should show provenance for every item so the conveyancer can verify it', () => {
    render(<QuoteScopeBlock scope={scope} />);
    expect(screen.getByText(/HMLR title BD101346, edition 2024-11-02/)).toBeInTheDocument();
    expect(screen.getByText(/Groundsure environmental report/)).toBeInTheDocument();
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
});
