// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import {
  lookupCompany,
  normalizeCompanyNumber,
  type CompaniesHouseCompany,
} from './companies-house.service';

const activeCompany: CompaniesHouseCompany = {
  companyNumber: '12345678',
  name: 'Sandy Meadows Developments Ltd',
  status: 'active',
  incorporatedOn: '2018-03-12',
  address: {
    line1: '1 High Street',
    locality: 'Sandy',
    postalCode: 'SG19 1AB',
    country: 'England',
  },
  isActive: true,
};

const dissolvedCompany: CompaniesHouseCompany = {
  ...activeCompany,
  status: 'dissolved',
  isActive: false,
};

describe('companies-house.service', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('1. happy path: 200 with active company → returns mapped object', async () => {
    invokeMock.mockResolvedValueOnce({ data: activeCompany, error: null });
    const result = await lookupCompany('12345678');
    expect(result).toEqual(activeCompany);
    expect(result?.isActive).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('companies-house-lookup', {
      body: { companyNumber: '12345678' },
    });
  });

  it('2. dissolved company → returns object with isActive false', async () => {
    invokeMock.mockResolvedValueOnce({ data: dissolvedCompany, error: null });
    const result = await lookupCompany('12345678');
    expect(result?.status).toBe('dissolved');
    expect(result?.isActive).toBe(false);
  });

  it('3. not found: edge function returns data: null → null', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await lookupCompany('12345678');
    expect(result).toBeNull();
  });

  it('4. edge function returns error → null', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'upstream timeout' },
    });
    const result = await lookupCompany('12345678');
    expect(result).toBeNull();
  });

  it('5. edge function throws → null (caught)', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Network down'));
    const result = await lookupCompany('12345678');
    expect(result).toBeNull();
  });

  it('6. invalid format → null without invoking the edge function', async () => {
    const result = await lookupCompany('ABC');
    expect(result).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('7. whitespace normalization: leading/trailing spaces are stripped', async () => {
    invokeMock.mockResolvedValueOnce({ data: activeCompany, error: null });
    await lookupCompany('  12345678  ');
    expect(invokeMock).toHaveBeenCalledWith('companies-house-lookup', {
      body: { companyNumber: '12345678' },
    });
  });

  it('8. already-uppercase passthrough: SC123456', async () => {
    invokeMock.mockResolvedValueOnce({ data: activeCompany, error: null });
    await lookupCompany('SC123456');
    expect(invokeMock).toHaveBeenCalledWith('companies-house-lookup', {
      body: { companyNumber: 'SC123456' },
    });
  });

  it('9. SC prefix (Scotland) is uppercased from lowercase', async () => {
    invokeMock.mockResolvedValueOnce({ data: activeCompany, error: null });
    await lookupCompany('sc123456');
    expect(invokeMock).toHaveBeenCalledWith('companies-house-lookup', {
      body: { companyNumber: 'SC123456' },
    });
  });

  it('10. NI prefix (Northern Ireland) is uppercased', async () => {
    invokeMock.mockResolvedValueOnce({ data: activeCompany, error: null });
    await lookupCompany('ni987654');
    expect(invokeMock).toHaveBeenCalledWith('companies-house-lookup', {
      body: { companyNumber: 'NI987654' },
    });
  });

  it('11. already-aborted signal → null without invoking', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await lookupCompany('12345678', { signal: controller.signal });
    expect(result).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  // Bonus: normalizeCompanyNumber unit tests
  it('normalizeCompanyNumber rejects too-short input', () => {
    expect(normalizeCompanyNumber('1234567')).toBeNull();
  });

  it('normalizeCompanyNumber rejects bad prefix', () => {
    expect(normalizeCompanyNumber('AB1234567')).toBeNull();
  });

  it('normalizeCompanyNumber accepts plain 8 digits', () => {
    expect(normalizeCompanyNumber('00000006')).toBe('00000006');
  });
});
