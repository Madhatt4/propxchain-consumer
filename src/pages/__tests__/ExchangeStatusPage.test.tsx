// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockInitialize = vi.fn();
const mockGetTransaction = vi.fn();
const mockGetDepositSent = vi.fn();
const mockGetRegistrationStatus = vi.fn();
vi.mock('@/services/icp.service', () => ({
  icpService: {
    initialize: (...a: unknown[]) => mockInitialize(...a),
    getTransactionByTextId: (...a: unknown[]) => mockGetTransaction(...a),
    getDepositSent: (...a: unknown[]) => mockGetDepositSent(...a),
    getRegistrationStatus: (...a: unknown[]) => mockGetRegistrationStatus(...a),
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
  mockGetDepositSent.mockResolvedValue(null);
  mockGetRegistrationStatus.mockResolvedValue(null);
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

  it("should show the deposit the buyer's conveyancer recorded as sent, with the amount in pounds", async () => {
    // Arrange
    mockGetTransaction.mockResolvedValue({ ...BASE_TX, status: 'exchanged', exchangedAt: EXCHANGED_NS });
    mockGetDepositSent.mockResolvedValue({ sentOn: '2026-11-03', amountPence: 2_500_000 });

    // Act
    renderAt('TX-TEST-1');

    // Assert
    expect(await screen.findByText("Deposit of £25,000.00 sent by the buyer's conveyancer on 3 November 2026")).toBeInTheDocument();
    expect(mockGetDepositSent).toHaveBeenCalledWith('TX-TEST-1');
  });

  it('should show the registration application once recorded, and the wait before that', async () => {
    // Arrange
    mockGetTransaction.mockResolvedValue({ ...BASE_TX, status: 'blockchain_completed', exchangedAt: EXCHANGED_NS });
    mockGetRegistrationStatus.mockResolvedValueOnce({
      completedAt: 1, awaitingApplication: false, submittedOn: '2026-11-13', applicationReference: 'TEST/123',
    });

    // Act
    const { unmount } = render(
      <MemoryRouter initialEntries={['/exchange/TX-TEST-1']}>
        <Routes><Route path="/exchange/:transactionId" element={<ExchangeStatusPage />} /></Routes>
      </MemoryRouter>,
    );

    // Assert
    expect(await screen.findByText('Registration application submitted to HM Land Registry on 13 November 2026, ref TEST/123')).toBeInTheDocument();
    unmount();

    mockGetRegistrationStatus.mockResolvedValueOnce({
      completedAt: 1, awaitingApplication: true, submittedOn: null, applicationReference: null,
    });
    renderAt('TX-TEST-1');
    expect(await screen.findByText("Waiting for the buyer's conveyancer to submit the registration application")).toBeInTheDocument();
  });

  it('should leave both rows out, with no error, when the records cannot be read', async () => {
    // Arrange
    mockGetTransaction.mockResolvedValue({ ...BASE_TX, status: 'exchanged', exchangedAt: EXCHANGED_NS });
    mockGetDepositSent.mockRejectedValue(new Error('method not found'));
    mockGetRegistrationStatus.mockRejectedValue(new Error('method not found'));

    // Act
    renderAt('TX-TEST-1');
    await screen.findByText('Exchanged on 3 November 2026');
    await waitFor(() => expect(mockGetRegistrationStatus).toHaveBeenCalled());

    // Assert
    expect(screen.queryByText('Deposit')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration application')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
