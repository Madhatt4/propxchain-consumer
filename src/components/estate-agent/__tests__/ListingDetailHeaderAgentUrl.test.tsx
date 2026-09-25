// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ListingDetailHeader } from '../ListingDetailHeader';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

function makeRow(overrides: Partial<AgentListingRow> = {}): AgentListingRow {
  return {
    id: 'L1',
    organisation_id: 'org-1',
    slug: 'demo-sons-sg19-1hq-abc123',
    status: 'under_offer',
    source: 'manual',
    source_url: null,
    agent_url: null,
    listing: { address: '45 Laburnum Road, Sandy', price: 289950 } as AgentListingRow['listing'],
    provenance: {} as AgentListingRow['provenance'],
    material_info: {} as AgentListingRow['material_info'],
    transaction_id: null,
    published_at: '2026-09-01T00:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function renderHeader(row: AgentListingRow): void {
  render(
    <MemoryRouter>
      <ListingDetailHeader
        row={row}
        canPublish
        onStatusChange={vi.fn()}
        onPublish={vi.fn()}
        onStartSale={vi.fn()}
        agentPrincipal="principal-1"
      />
    </MemoryRouter>,
  );
}

describe('ListingDetailHeader — public page and agency site', () => {
  it('should open the PropXchain public page in a new tab', () => {
    // Following it in the same tab strands the agent on an anonymous page with
    // no app chrome and nothing to click back to.
    renderHeader(makeRow());

    const link = screen.getByRole('link', { name: 'View public page' });
    expect(link).toHaveAttribute('href', '/property/demo-sons-sg19-1hq-abc123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('should not offer the agency-site button when no URL is recorded', () => {
    renderHeader(makeRow({ agent_url: null }));

    expect(screen.queryByRole('link', { name: 'View on our site' })).not.toBeInTheDocument();
  });

  it('should offer the agency-site button alongside the public page, not instead of it', () => {
    // Both, deliberately: the PropXchain page is the one publishing material
    // information up front, so it must stay reachable from the portal.
    renderHeader(makeRow({ agent_url: 'https://demoandsons.co.uk/45-laburnum-road' }));

    expect(screen.getByRole('link', { name: 'View public page' })).toBeInTheDocument();
    const agentLink = screen.getByRole('link', { name: 'View on our site' });
    expect(agentLink).toHaveAttribute('href', 'https://demoandsons.co.uk/45-laburnum-road');
    expect(agentLink).toHaveAttribute('target', '_blank');
    expect(agentLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('should render nothing for a javascript: URL that reached the row another way', () => {
    renderHeader(makeRow({ agent_url: 'javascript:alert(1)' }));

    expect(screen.queryByRole('link', { name: 'View on our site' })).not.toBeInTheDocument();
  });

  it('should still show Publish, and no agency-site button, before the listing has a slug', () => {
    renderHeader(makeRow({ slug: null, agent_url: null }));

    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View public page' })).not.toBeInTheDocument();
  });
});
