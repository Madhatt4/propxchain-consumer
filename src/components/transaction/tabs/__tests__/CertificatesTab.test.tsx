// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));

vi.mock('@/services/documentFacts.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/documentFacts.service')>();
  return { ...actual, loadCurrentFacts: (...a: unknown[]) => mockLoad(...a) };
});

import { CertificatesTab } from '../CertificatesTab';
import type { CurrentFact } from '@/services/documentFacts.service';

function fact(factKey: string, overrides: Partial<CurrentFact> = {}): CurrentFact {
  return {
    factKey,
    value: 'true',
    method: 'jev',
    status: 'confirmed',
    storagePath: 'transactions/tx/ta6/abc.jpg',
    checkedAt: '2026-10-15T09:00:00.000Z',
    decidedAt: '2026-10-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('CertificatesTab', () => {
  beforeEach(() => mockLoad.mockReset());

  it("should list each confirmed certificate fact under its certificate with the date it was confirmed", async () => {
    mockLoad.mockResolvedValue([fact('gas_safety.passed'), fact('epc.band', { value: 'C' })]);

    render(<CertificatesTab transactionId="tx-1" />);

    expect(await screen.findByRole('region', { name: 'Gas safety record' })).toBeTruthy();
    expect(screen.getByText('Every gas appliance passed')).toBeTruthy();
    expect(screen.getByText('EPC rating C')).toBeTruthy();
    expect(screen.getAllByText('confirmed 15 Oct 2026')).toHaveLength(2);
    expect(mockLoad).toHaveBeenCalledWith('tx-1');
  });

  it("should say which day a photo's in-date was judged", async () => {
    mockLoad.mockResolvedValue([fact('gas_safety.in_date')]);

    render(<CertificatesTab transactionId="tx-1" />);

    expect(await screen.findByText('Gas safety record is in date (as of 15 Oct 2026)')).toBeTruthy();
  });

  it('should not show a suggestion the seller has not confirmed', async () => {
    mockLoad.mockResolvedValue([fact('eicr.satisfactory', { status: 'suggested', decidedAt: null })]);

    render(<CertificatesTab transactionId="tx-1" />);

    expect(await screen.findByText(/No certificates confirmed yet/)).toBeTruthy();
    expect(screen.queryByText('Electrics rated satisfactory')).toBeNull();
  });
});
