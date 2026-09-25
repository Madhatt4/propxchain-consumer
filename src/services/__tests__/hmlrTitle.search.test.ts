import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep the heavy module graph out of the unit under test.
vi.mock('../icp.service', () => ({ icpService: {} }));
vi.mock('../../utils/hashGenerator', () => ({
  generateBufferHash: vi.fn(),
  isValidSHA256Hash: vi.fn(() => true),
}));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGetSession = vi.fn(async () => ({
  data: { session: { access_token: 'jwt-123' } },
  error: null,
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

import {
  hmlrTitleService,
  splitAddressLine1,
  HmlrPullError,
} from '../hmlrTitle.service';

function jsonResponse(ok: boolean, status: number, body: unknown) {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'jwt-123' } },
    error: null,
  });
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('splitAddressLine1', () => {
  it('splits a leading house number from the street', () => {
    expect(splitAddressLine1('12 High Street')).toEqual({
      houseNumber: '12',
      streetName: 'High Street',
    });
  });

  it('keeps a trailing letter on the house number (e.g. 12A)', () => {
    expect(splitAddressLine1('12A Shannon Court')).toEqual({
      houseNumber: '12A',
      streetName: 'Shannon Court',
    });
  });

  it('treats a non-numeric line as a house name', () => {
    expect(splitAddressLine1('Rose Cottage')).toEqual({
      houseName: 'Rose Cottage',
    });
  });

  it('returns an empty object for blank input', () => {
    expect(splitAddressLine1('   ')).toEqual({});
  });

  it('should classify a bare street as streetName when it ends in a street suffix', () => {
    // Rightmove imports carry no house number — "Ivel Road" sent as a
    // BuildingName made HMLR reject the whole search (2026-07-22).
    expect(splitAddressLine1('Ivel Road')).toEqual({ streetName: 'Ivel Road' });
    expect(splitAddressLine1('Mill Lane')).toEqual({ streetName: 'Mill Lane' });
    expect(splitAddressLine1('Station Avenue')).toEqual({ streetName: 'Station Avenue' });
    expect(splitAddressLine1('The Crescent')).toEqual({ streetName: 'The Crescent' });
  });

  it('should keep house names that merely contain a suffix word mid-string', () => {
    expect(splitAddressLine1('Lane End Cottage')).toEqual({
      houseName: 'Lane End Cottage',
    });
  });
});

describe('hmlrTitleService.searchTitlesByAddress', () => {
  it('maps a TypeCode 30 result into matches and forwards address fields', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(true, 200, {
        postcode: 'SG19 1AG',
        typeCode: 30,
        matchCount: 2,
        matches: [
          { titleNumber: 'BD120274', addressDisplay: '1 HIGH STREET, SANDY, SG19 1AG', tenure: 'Freehold' },
          { titleNumber: 'BD268495', addressDisplay: 'FLAT 1, 1 HIGH STREET, SANDY, SG19 1AG', tenure: 'Leasehold' },
        ],
        acknowledgement: null,
        rejection: null,
      }),
    );

    const result = await hmlrTitleService.searchTitlesByAddress({
      postcode: 'SG19 1AG',
      houseNumber: '1',
      streetName: 'High Street',
    });

    expect(result.typeCode).toBe(30);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toEqual({
      titleNumber: 'BD120274',
      addressDisplay: '1 HIGH STREET, SANDY, SG19 1AG',
      tenure: 'Freehold',
    });

    // Auth header + body forwarded correctly.
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/title-search');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
    expect(JSON.parse(init.body as string)).toEqual({
      postcode: 'SG19 1AG',
      houseNumber: '1',
      streetName: 'High Street',
    });
  });

  it('surfaces a TypeCode 20 rejection', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(true, 200, {
        postcode: 'SG19 1AG',
        typeCode: 20,
        matchCount: 0,
        matches: [],
        acknowledgement: null,
        rejection: { reason: 'Insufficient address details', code: 'bg.invalid.property.search.criteria' },
      }),
    );

    const result = await hmlrTitleService.searchTitlesByAddress({ postcode: 'SG19 1AG' });
    expect(result.typeCode).toBe(20);
    expect(result.matches).toHaveLength(0);
    expect(result.rejection).toEqual({
      reason: 'Insufficient address details',
      code: 'bg.invalid.property.search.criteria',
    });
  });

  it('throws when no postcode is supplied (no network call)', async () => {
    await expect(
      hmlrTitleService.searchTitlesByAddress({ postcode: '   ' }),
    ).rejects.toBeInstanceOf(HmlrPullError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws HmlrPullError on a non-2xx proxy response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(false, 401, { error: 'unauthorized', reason: 'bad token' }),
    );
    await expect(
      hmlrTitleService.searchTitlesByAddress({ postcode: 'SG19 1AG' }),
    ).rejects.toMatchObject({ status: 401, cause: 'unauthorized' });
  });

  it('drops malformed matches missing a title number', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(true, 200, {
        typeCode: 30,
        matches: [
          { titleNumber: 'BD1', addressDisplay: 'A', tenure: 'Freehold' },
          { addressDisplay: 'no title', tenure: 'Freehold' },
          null,
        ],
        acknowledgement: null,
        rejection: null,
      }),
    );
    const result = await hmlrTitleService.searchTitlesByAddress({ postcode: 'SG19 1AG' });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].titleNumber).toBe('BD1');
  });
});
