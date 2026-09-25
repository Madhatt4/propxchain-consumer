// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Tests for estateAgentListings.service.ts — mocks Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateListingSlug, estateAgentListingsService } from '../estateAgentListings.service';
import { emptyMaterialInfo } from '@/utils/materialInfo';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

const mockGetSession = vi.fn();
const mockInvoke = vi.fn();
const mockBuildPrincipalProof = vi.fn();

vi.mock('@/services/principalProof', () => ({
  buildPrincipalProof: (message: string) => mockBuildPrincipalProof(message),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    })),
  },
}));

function fakeRow(overrides: Partial<AgentListingRow> = {}): AgentListingRow {
  return {
    id: 'abcdef12-3456-7890-abcd-ef1234567890',
    organisation_id: 'org-1',
    slug: null,
    status: 'draft',
    source: 'manual',
    source_url: null,
    agent_url: null,
    listing: { postcode: 'SG19 1AB' } as AgentListingRow['listing'],
    provenance: {},
    material_info: emptyMaterialInfo(),
    transaction_id: null,
    published_at: null,
    created_at: '2026-08-23T00:00:00Z',
    updated_at: '2026-08-23T00:00:00Z',
    ...overrides,
  };
}

describe('generateListingSlug', () => {
  it('should combine agency, postcode and id prefix', () => {
    expect(generateListingSlug('Acme Homes', 'SG19 1AB', 'abcdef12-3456-7890-abcd-ef1234567890')).toBe(
      'acme-homes-sg19-1ab-abcdef',
    );
  });
});

describe('estateAgentListingsService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should insert a draft with empty material info', async () => {
    const fakeListing = fakeRow();
    mockSingle.mockResolvedValue({ data: fakeListing, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: mockInsert });

    const result = await estateAgentListingsService.create({
      organisation_id: 'org-1',
      source: 'manual',
      source_url: null,
      listing: fakeListing.listing,
      provenance: {},
    });

    expect(result).toEqual(fakeListing);
    expect(supabase.from).toHaveBeenCalledWith('agent_listings');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', material_info: emptyMaterialInfo() }),
    );
  });

  it('should throw on supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS violation' } });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: mockInsert });

    await expect(
      estateAgentListingsService.create({
        organisation_id: 'org-1',
        source: 'manual',
        source_url: null,
        listing: { postcode: 'SG19 1AB' } as AgentListingRow['listing'],
        provenance: {},
      }),
    ).rejects.toThrow('Failed to create listing: RLS violation');
  });
});

describe('estateAgentListingsService.listByOrganisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return listings newest first', async () => {
    const fakeListings = [fakeRow()];
    mockOrder.mockResolvedValue({ data: fakeListings, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    const result = await estateAgentListingsService.listByOrganisation('org-1');
    expect(result).toEqual(fakeListings);
    expect(mockEq).toHaveBeenCalledWith('organisation_id', 'org-1');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('should throw on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'db error' } });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    await expect(estateAgentListingsService.listByOrganisation('org-1')).rejects.toThrow(
      'Failed to fetch listings: db error',
    );
  });
});

describe('estateAgentListingsService.getById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the row', async () => {
    const fakeListing = fakeRow();
    mockSingle.mockResolvedValue({ data: fakeListing, error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    const result = await estateAgentListingsService.getById(fakeListing.id);
    expect(result).toEqual(fakeListing);
  });

  it('should return null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    const result = await estateAgentListingsService.getById('missing-id');
    expect(result).toBeNull();
  });

  it('should throw on other errors', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    await expect(estateAgentListingsService.getById('bad-id')).rejects.toThrow('Failed to fetch listing: boom');
  });
});

describe('estateAgentListingsService.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update and return the row', async () => {
    const fakeListing = fakeRow({ source_url: 'https://example.com' });
    mockSingle.mockResolvedValue({ data: fakeListing, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockEq.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update: mockUpdate });

    const result = await estateAgentListingsService.update(fakeListing.id, { source_url: 'https://example.com' });
    expect(result).toEqual(fakeListing);
    expect(mockEq).toHaveBeenCalledWith('id', fakeListing.id);
  });

  it('should throw on error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'update failed' } });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockEq.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update: mockUpdate });

    await expect(estateAgentListingsService.update('id-1', { source_url: null })).rejects.toThrow(
      'Failed to update listing: update failed',
    );
  });
});

describe('estateAgentListingsService.linkTransaction', () => {
  const PROOF = { principal: 'aaaaa-aa', publicKeyDer: 'a2V5', signature: 'c2ln' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockBuildPrincipalProof.mockResolvedValue(PROOF);
  });

  it('should link through the edge function with a proof bound to listing, deal and user — never a direct table write', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, linked: true }, error: null });
    const { supabase } = await import('@/lib/supabase');

    await estateAgentListingsService.linkTransaction('ID-1', 'tx_1');

    expect(mockBuildPrincipalProof).toHaveBeenCalledWith('link-listing-transaction:id-1:tx_1:user-1');
    expect(mockInvoke).toHaveBeenCalledWith('link-listing-transaction', {
      body: { listingId: 'ID-1', transactionId: 'tx_1', ...PROOF },
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each(['listing_already_linked', 'transaction_already_linked'])(
    'should surface a clean message when the server refuses with %s',
    async (code) => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: code }) } },
      });

      await expect(estateAgentListingsService.linkTransaction('id-1', 'tx_1')).rejects.toThrow(
        'This listing is already linked to a sale.',
      );
    },
  );

  it('should throw with the server refusal code on other errors', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: async () => ({ error: 'not_the_creating_agent' }) } },
    });

    await expect(estateAgentListingsService.linkTransaction('id-1', 'tx_1')).rejects.toThrow(
      'Failed to link transaction: not_the_creating_agent',
    );
  });

  it('should refuse without a session or a principal proof, before calling the server', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(estateAgentListingsService.linkTransaction('id-1', 'tx_1')).rejects.toThrow('not signed in');

    mockBuildPrincipalProof.mockRejectedValueOnce(new Error('unsupported_identity'));
    await expect(estateAgentListingsService.linkTransaction('id-1', 'tx_1')).rejects.toThrow(
      'Failed to link transaction: unsupported_identity',
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('estateAgentListingsService.setStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update the status', async () => {
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update: mockUpdate });

    await estateAgentListingsService.setStatus('id-1', 'withdrawn');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'withdrawn' });
    expect(mockEq).toHaveBeenCalledWith('id', 'id-1');
  });

  it('should throw on error', async () => {
    mockEq.mockResolvedValue({ error: { message: 'nope' } });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update: mockUpdate });

    await expect(estateAgentListingsService.setStatus('id-1', 'withdrawn')).rejects.toThrow(
      'Failed to update listing status: nope',
    );
  });
});

describe('estateAgentListingsService.publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set slug, published_at and status for_sale on a draft with null slug', async () => {
    const draft = fakeRow({ status: 'draft', slug: null, published_at: null });

    mockSingle.mockResolvedValue({ data: draft, error: null });
    mockEq.mockReturnValueOnce({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    mockEq.mockResolvedValueOnce({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));

    const slug = await estateAgentListingsService.publish(draft.id, 'Acme Homes');

    expect(slug).toBe(generateListingSlug('Acme Homes', draft.listing.postcode, draft.id));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ slug, status: 'for_sale' }),
    );
    const updateCallArg = mockUpdate.mock.calls[0][0] as { published_at: string };
    expect(updateCallArg.published_at).toEqual(expect.any(String));
  });

  it('should keep status when already under_offer', async () => {
    const row = fakeRow({ status: 'under_offer', slug: 'existing-slug', published_at: '2026-08-01T00:00:00Z' });

    mockSingle.mockResolvedValue({ data: row, error: null });
    mockEq.mockReturnValueOnce({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    mockEq.mockResolvedValueOnce({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));

    const slug = await estateAgentListingsService.publish(row.id, 'Acme Homes');

    expect(slug).toBe('existing-slug');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'existing-slug', status: 'under_offer', published_at: row.published_at }),
    );
  });

  it('should throw when the listing is not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    mockEq.mockReturnValueOnce({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({ select: mockSelect }));

    await expect(estateAgentListingsService.publish('missing-id', 'Acme Homes')).rejects.toThrow(
      'Listing not found',
    );
  });
});

describe('estateAgentListingsService.getPublicBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query public_agent_listings and return the record', async () => {
    const publicRow = {
      slug: 'acme-homes-sg19-1ab-abcdef',
      status: 'for_sale',
      listing: { postcode: 'SG19 1AB' },
      material_info: emptyMaterialInfo(),
      published_at: '2026-08-23T00:00:00Z',
      agency_name: 'Acme Homes',
      agency_branch: 'Sandy',
    };
    mockSingle.mockResolvedValue({ data: publicRow, error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    const result = await estateAgentListingsService.getPublicBySlug('acme-homes-sg19-1ab-abcdef');
    expect(result).toEqual(publicRow);
    expect(supabase.from).toHaveBeenCalledWith('public_agent_listings');
    expect(mockEq).toHaveBeenCalledWith('slug', 'acme-homes-sg19-1ab-abcdef');
  });

  it('should return null on no row (PGRST116)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    const result = await estateAgentListingsService.getPublicBySlug('missing-slug');
    expect(result).toBeNull();
  });

  it('should throw on other errors', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '500', message: 'db down' } });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: mockSelect });

    await expect(estateAgentListingsService.getPublicBySlug('bad-slug')).rejects.toThrow(
      'Failed to fetch public listing: db down',
    );
  });
});
