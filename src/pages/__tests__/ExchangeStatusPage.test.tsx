// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockInitialize = vi.fn();
const mockGetTransaction = vi.fn();
vi.mock('@/services/icp.service', () => ({
  icpService: {
    initialize: (...a: unknown[]) => mockInitialize(...a),
    getTransactionByTextId: (...a: unknown[]) => mockGetTransaction(...a),
  },
}));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import ExchangeStatusPage from '../ExchangeStatusPage';

// 2026-11-03T12:00:00Z as canister nanoseconds.
const EXCHANGED_NS = Date.UTC(2026, 10, 3, 12) * 1_000_000;

const BASE_TX = {
  id: 'TX-TEST-1',
  propertyAddress: '1 Example Street, Testtown',
  status: 'active',
  completionDate: '',
  buyerSolicitorSignature: null,
  sellerSolicitorSignature: null,
  exchangedAt: null,
  contractExchangeTimestamp: null,
};

function renderAt(id: string): void {
  render(
    <MemoryRouter initialEntries={[`/exchange/${id}`]}>
      <Routes>
        <Route path="/exchange/:transactionId" element={<ExchangeStatusPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// happy-dom has no window.alert, so stub one to prove the page never calls it.
const alertSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mockInitialize.mockResolvedValue(undefined);
  vi.stubGlobal('alert', alertSpy);
});
afterEach(() => vi.unstubAllGlobals());

describe('ExchangeStatusPage', () => {
  it('should show not exchanged with no confirmations before the conveyancers record exchange', async () => {
    mockGetTransaction.mockResolvedValue({ ...BASE_TX, buyerSolicitorSignature: 'sig-b' });
    renderAt('TX-TEST-1');

    expect(await screen.findByText('Not exchanged yet')).toBeInTheDocument();
    expect(mockGetTransaction).toHaveBeenCalledWith('TX-TEST-1');
    const buyerRow = screen.getByText("Buyer's conveyancer: exchange confirmed").parentElement;
    const sellerRow = screen.getByText("Seller's conveyancer: exchange confirmed").parentElement;
    expect(buyerRow).toHaveTextContent('Recorded on PropXchain');
    expect(sellerRow).toHaveTextContent('Not recorded yet');
    expect(screen.getByText(/Your conveyancers handle exchange/)).toBeInTheDocument();
  });

  it('should show the exchange date, completion date and both confirmations once exchanged', async () => {
    mockGetTransaction.mockResolvedValue({
      ...BASE_TX,
      status: 'exchanged',
      completionDate: '2026-12-01',
      buyerSolicitorSignature: 'sig-b',
      sellerSolicitorSignature: 'sig-s',
      exchangedAt: EXCHANGED_NS,
    });
    renderAt('TX-TEST-1');

    expect(await screen.findByText('Exchanged on 3 November 2026')).toBeInTheDocument();
    expect(screen.getByText('1 December 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Recorded on PropXchain')).toHaveLength(2);
    expect(screen.getByText(/legally binding/)).toBeInTheDocument();
  });

  it('should say PropXchain does not hold money and offer no codes, escrow or sign actions', async () => {
    mockGetTransaction.mockResolvedValue({ ...BASE_TX, status: 'exchanged', exchangedAt: EXCHANGED_NS });
    renderAt('TX-TEST-1');

    expect(await screen.findByText(/PropXchain does not hold or move any money/)).toBeInTheDocument();
    expect(screen.getByText(/client account/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/escrow|confirmation code|quote/i);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('should show a not-found message when the deal cannot be read', async () => {
    mockGetTransaction.mockResolvedValue(null);
    renderAt('TX-MISSING');
    expect(await screen.findByText(/could not find this deal/)).toBeInTheDocument();
  });

  it('should contain no alert, browser-made codes or escrow steps in its source', () => {
    const src = readFileSync(resolve(__dirname, '../ExchangeStatusPage.tsx'), 'utf8');
    expect(src).not.toMatch(/\balert\(/);
    expect(src).not.toMatch(/generateCode|Math\.random|localStorage/);
    expect(src).not.toMatch(/escrow/i);
  });
});
