// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Tests for sites.service.ts — mocks Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSlug, sitesService } from './sites.service';

// Mock supabase client
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    })),
  },
}));

describe('generateSlug', () => {
  it('should lowercase and hyphenate a simple name', () => {
    expect(generateSlug('Meadow View Park')).toBe('meadow-view-park');
  });

  it('should strip non-alphanumeric characters', () => {
    expect(generateSlug("St. Mary's Estate")).toBe('st-mary-s-estate');
  });

  it('should collapse multiple hyphens', () => {
    expect(generateSlug('A   B---C')).toBe('a-b-c');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle numbers in name', () => {
    expect(generateSlug('Phase 2 - Riverside')).toBe('phase-2-riverside');
  });
});

describe('sitesService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should insert and return the created site', async () => {
    const fakeSite = {
      id: 'uuid-1',
      organisation_id: 'org-1',
      name: 'Test Site',
      slug: 'test-site',
      address: '123 Main St',
      postcode: 'MK42 9AB',
      total_plots: 10,
      appointed_solicitor_firm: null,
      appointed_solicitor_contact: null,
      appointed_solicitor_email: null,
      status: 'planning',
      created_at: '2026-04-10T00:00:00Z',
      updated_at: '2026-04-10T00:00:00Z',
    };

    mockSingle.mockResolvedValue({ data: fakeSite, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: mockInsert,
    });

    const result = await sitesService.create({
      organisation_id: 'org-1',
      name: 'Test Site',
      slug: 'test-site',
      address: '123 Main St',
      postcode: 'MK42 9AB',
      total_plots: 10,
    });

    expect(result).toEqual(fakeSite);
    expect(supabase.from).toHaveBeenCalledWith('development_sites');
  });

  it('should throw on supabase error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS violation' } });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: mockInsert,
    });

    await expect(
      sitesService.create({
        organisation_id: 'org-1',
        name: 'Test',
        slug: 'test',
        address: '123 St',
        postcode: 'AB1 2CD',
        total_plots: 1,
      }),
    ).rejects.toThrow('Failed to create site: RLS violation');
  });
});

describe('sitesService.getByOrganisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return sites ordered by created_at desc', async () => {
    const fakeSites = [{ id: 'uuid-1', name: 'Site A' }];

    mockOrder.mockResolvedValue({ data: fakeSites, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
    });

    const result = await sitesService.getByOrganisation('org-1');
    expect(result).toEqual(fakeSites);
    expect(mockEq).toHaveBeenCalledWith('organisation_id', 'org-1');
  });

  it('should throw on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'db error' } });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
    });

    await expect(sitesService.getByOrganisation('org-1')).rejects.toThrow('Failed to fetch sites: db error');
  });
});

describe('sitesService.checkSlugAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when count is 0', async () => {
    mockEq.mockResolvedValue({ count: 0, error: null });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
    });

    const result = await sitesService.checkSlugAvailable('new-slug');
    expect(result).toBe(true);
    expect(mockEq).toHaveBeenCalledWith('slug', 'new-slug');
  });

  it('should return false when count is > 0', async () => {
    mockEq.mockResolvedValue({ count: 1, error: null });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
    });

    const result = await sitesService.checkSlugAvailable('taken-slug');
    expect(result).toBe(false);
  });

  it('should throw on error', async () => {
    mockEq.mockResolvedValue({ count: null, error: { message: 'oops' } });
    mockSelect.mockReturnValue({ eq: mockEq });

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
    });

    await expect(sitesService.checkSlugAvailable('bad')).rejects.toThrow('Slug check failed: oops');
  });
});
