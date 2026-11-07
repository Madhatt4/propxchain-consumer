import { describe, it, expect, vi, beforeEach } from 'vitest';
import { currentUserIsTestAccount, keepFirmsFor } from '../testFirm';
import { SupabaseProviderDataSource } from '../supabaseProviderDataSource';
import { supabase } from '../../lib/supabase';

const getSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: () => getSession() } },
}));
vi.mock('../postcodeService', () => ({
  postcodeService: { lookupPostcode: vi.fn().mockResolvedValue(null) },
  calculateDistanceMiles: vi.fn().mockReturnValue(1),
}));

function sessionWith(appMetadata: Record<string, unknown>): { data: { session: unknown } } {
  return { data: { session: { user: { app_metadata: appMetadata } } } };
}

function makeRow(id: string, isTest?: boolean): Record<string, unknown> {
  return {
    id, practice_name: id, clc_id: '1', postcode: 'AB1 2CD', city: 'Town', county: null,
    lat: null, lng: null, services: null, recommended: false, rating: 1, review_count: 1,
    active_on_panel: true, status: 'Active', ...(isTest === undefined ? {} : { is_test: isTest }),
  };
}

function mockPanelRows(rows: Record<string, unknown>[]): void {
  const chain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    }),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
}

describe('currentUserIsTestAccount', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it('should be true when app_metadata carries the test flag', async () => {
    getSession.mockResolvedValue(sessionWith({ propxchain_test_account: true }));
    expect(await currentUserIsTestAccount()).toBe(true);
  });

  it('should be false for an ordinary signed-in client', async () => {
    getSession.mockResolvedValue(sessionWith({ provider: 'email' }));
    expect(await currentUserIsTestAccount()).toBe(false);
  });

  it('should be false when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await currentUserIsTestAccount()).toBe(false);
  });

  it('should be false when reading the session fails', async () => {
    getSession.mockRejectedValue(new Error('offline'));
    expect(await currentUserIsTestAccount()).toBe(false);
  });
});

describe('keepFirmsFor', () => {
  const rows = [{ id: 'real', is_test: false }, { id: 'test', is_test: true }, { id: 'legacy' }];

  it('should keep real firms only for a client, treating a missing flag as real', () => {
    expect(keepFirmsFor(rows, false).map((r) => r.id)).toEqual(['real', 'legacy']);
  });

  it('should keep test firms only for a test account', () => {
    expect(keepFirmsFor(rows, true).map((r) => r.id)).toEqual(['test']);
  });

  it('should return an empty list for no rows', () => {
    expect(keepFirmsFor([], true)).toEqual([]);
  });
});

describe('SupabaseProviderDataSource and test firms', () => {
  beforeEach(() => {
    getSession.mockReset();
    mockPanelRows([makeRow('real', false), makeRow('test', true)]);
  });

  it('should never list a test firm to a client', async () => {
    getSession.mockResolvedValue(sessionWith({}));
    const result = await new SupabaseProviderDataSource().getProviders('conveyancer', {});
    expect(result.map((p) => p.id)).toEqual(['real']);
  });

  it('should list only test firms to a test account', async () => {
    getSession.mockResolvedValue(sessionWith({ propxchain_test_account: true }));
    const result = await new SupabaseProviderDataSource().getProviders('conveyancer', {});
    expect(result.map((p) => p.id)).toEqual(['test']);
  });

  it('should return null when a client opens a test firm by id', async () => {
    getSession.mockResolvedValue(sessionWith({}));
    const single = vi.fn().mockResolvedValue({ data: makeRow('test', true), error: null });
    vi.mocked(supabase.from).mockReturnValue(
      { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) } as never,
    );
    expect(await new SupabaseProviderDataSource().getProvider('test')).toBeNull();
  });
});
