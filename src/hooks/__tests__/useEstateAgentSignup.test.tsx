// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { lookupCompany } = vi.hoisted(() => ({ lookupCompany: vi.fn() }));
// Mirrors the real UK company number pattern (8 digits, or 2-letter prefix +
// 6 digits), matching how the real companies-house.service normalises input.
const UK_COMPANY_NUMBER_RE = /^([0-9]{8}|[A-Z]{2}[0-9]{6})$/;
vi.mock('../../services/companies-house.service', () => ({
  lookupCompany,
  normalizeCompanyNumber: (s: string) => {
    const cleaned = s.trim().toUpperCase();
    return UK_COMPANY_NUMBER_RE.test(cleaned) ? cleaned : null;
  },
}));

import { useEstateAgentSignup } from '../useEstateAgentSignup';

describe('useEstateAgentSignup — Companies House lookup', () => {
  beforeEach(() => {
    lookupCompany.mockReset();
  });

  it('resets chData and verified when a valid company number is cleared or edited to non-normalisable', async () => {
    lookupCompany.mockResolvedValue({
      companyNumber: '12345678',
      name: 'Acme Homes Ltd',
      status: 'active',
      incorporatedOn: '2010-01-01',
      address: {},
      isActive: true,
    });

    const { result } = renderHook(() => useEstateAgentSignup());

    act(() => {
      result.current.setBusinessDetails({ ...result.current.businessDetails, companyNumber: '12345678' });
    });

    await waitFor(() => expect(result.current.businessDetails.chData).not.toBeNull(), { timeout: 2000 });
    expect(result.current.businessDetails.verified).toBe(true);

    act(() => {
      result.current.setBusinessDetails({ ...result.current.businessDetails, companyNumber: '' });
    });

    await waitFor(() => expect(result.current.businessDetails.chData).toBeNull());
    expect(result.current.businessDetails.verified).toBe(false);
  });
});
